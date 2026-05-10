import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { getSeverity, getOverallScore, getScoreLabel, type SeverityLevel } from '../utils/severity.js';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter
const USABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// Column widths — must sum to USABLE_WIDTH (512)
const COL = {
    method:     50,
    endpoint:  145,
    attackType: 80,
    statusCode: 58,
    latency:    50,
    severity:   57,
    result:     72,
};

// Palette
const COLOR = {
    black:       '#000000',
    white:       '#FFFFFF',
    accent:      '#06b6d4',
    headerBg:    '#0a0a0a',
    rowAlt:      '#f8f8f8',
    red:         '#ef4444',
    orange:      '#f97316',
    yellow:      '#eab308',
    green:       '#22c55e',
    blue:        '#3b82f6',
    muted:       '#6b7280',
    border:      '#e5e7eb',
    sectionBg:   '#f1f5f9',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resultLabel(statusCode: number): string {
    if (statusCode >= 500) return 'VULNERABLE';
    if (statusCode >= 400) return 'SUSPICIOUS';
    return 'PASS';
}

function resultColor(statusCode: number): string {
    if (statusCode >= 500) return COLOR.red;
    if (statusCode >= 400) return COLOR.orange;
    return COLOR.green;
}

function scoreColor(score: number): string {
    if (score <= 25) return COLOR.red;
    if (score <= 50) return COLOR.orange;
    if (score <= 75) return COLOR.yellow;
    return COLOR.green;
}

function severityColor(sev: SeverityLevel): string {
    switch (sev) {
        case 'CRITICAL': return COLOR.red;
        case 'HIGH':     return COLOR.orange;
        case 'MEDIUM':   return COLOR.yellow;
        case 'LOW':      return COLOR.blue;
        default:         return COLOR.muted;
    }
}

const SEVERITY_RANK: Record<SeverityLevel, number> = {
    CRITICAL: 0,
    HIGH:     1,
    MEDIUM:   2,
    LOW:      3,
    INFO:     4,
};

function truncate(str: string, max: number): string {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function drawHRule(doc: PDFKit.PDFDocument, y: number) {
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + USABLE_WIDTH, y)
        .strokeColor(COLOR.border).lineWidth(0.5).stroke();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateTestRunPDF(testRunId: string, userId: string): Promise<Buffer> {
    const testRun = await prisma.testRun.findUnique({
        where: { id: testRunId },
        include: { logs: { orderBy: { createdAt: 'asc' } } },
    });

    if (!testRun) {
        const err = Object.assign(new Error('Test run not found'), { statusCode: 404 });
        throw err;
    }

    if (testRun.userId && testRun.userId !== userId) {
        const err = Object.assign(new Error('Forbidden'), { statusCode: 403 });
        throw err;
    }

    // ---- Aggregate metrics ----
    const logs = testRun.logs;
    const totalLatency = logs.reduce((s, l) => s + (l.latencyMs ?? 0), 0);
    const avgLatency = logs.length > 0 ? Math.round(totalLatency / logs.length) : 0;

    // Score + severity breakdown
    const scoredLogs = logs.map(l => ({
        severity: getSeverity(l.attackType, l.statusCode ?? 0, l.responseSnippet ?? ''),
        statusCode: l.statusCode ?? 0,
    }));
    const overallScore = getOverallScore(scoredLogs);
    const scoreLabel = getScoreLabel(overallScore);
    const breakdown = {
        critical: scoredLogs.filter(l => l.severity === 'CRITICAL').length,
        high:     scoredLogs.filter(l => l.severity === 'HIGH').length,
        medium:   scoredLogs.filter(l => l.severity === 'MEDIUM').length,
        low:      scoredLogs.filter(l => l.severity === 'LOW').length,
        info:     scoredLogs.filter(l => l.severity === 'INFO').length,
    };
    const criticalFailures = scoredLogs.filter(l => l.statusCode >= 500).length;

    // Sort: CRITICAL → HIGH → MEDIUM → LOW → INFO
    const sortedLogs = logs
        .map(l => ({
            ...l,
            severity: getSeverity(l.attackType, l.statusCode ?? 0, l.responseSnippet ?? ''),
        }))
        .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

    const generatedAt = new Date();

    // ---- Build PDF ----
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'LETTER', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const endPromise = new Promise<void>(resolve => doc.on('end', resolve));

    // ================================================================
    // 1. HEADER
    // ================================================================
    doc.rect(0, 0, PAGE_WIDTH, 90).fill(COLOR.headerBg);

    doc.fillColor(COLOR.accent)
        .font('Helvetica-Bold').fontSize(22)
        .text('ONYX', PAGE_MARGIN, 22, { continued: true })
        .fillColor(COLOR.white)
        .font('Helvetica').fontSize(22)
        .text(' Security Report');

    doc.fillColor(COLOR.muted).font('Helvetica').fontSize(8)
        .text(`Run ID: ${testRun.id}   ·   Generated: ${generatedAt.toUTCString()}`, PAGE_MARGIN, 52);

    doc.fillColor('#94a3b8').fontSize(8)
        .text(`Target: ${truncate(testRun.specUrl, 90)}`, PAGE_MARGIN, 66);

    doc.y = 110;

    // ================================================================
    // 2. EXECUTIVE SUMMARY
    // ================================================================
    doc.fillColor(COLOR.black).font('Helvetica-Bold').fontSize(10)
        .text('EXECUTIVE SUMMARY', PAGE_MARGIN, doc.y, { characterSpacing: 1 });

    doc.moveDown(0.4);
    drawHRule(doc, doc.y);
    doc.moveDown(0.6);

    const boxTop = doc.y;
    const boxHeight = 94;
    doc.rect(PAGE_MARGIN, boxTop, USABLE_WIDTH, boxHeight).fill(COLOR.sectionBg).stroke();
    doc.strokeColor(COLOR.border).lineWidth(1)
        .rect(PAGE_MARGIN, boxTop, USABLE_WIDTH, boxHeight).stroke();

    // Score — big number, right-aligned
    const scoreStr = String(overallScore);
    doc.font('Helvetica-Bold').fontSize(28)
        .fillColor(scoreColor(overallScore))
        .text(scoreStr, PAGE_MARGIN + USABLE_WIDTH - 110, boxTop + 8, { width: 58, align: 'right' });
    doc.font('Helvetica').fontSize(11).fillColor(COLOR.muted)
        .text('/100', PAGE_MARGIN + USABLE_WIDTH - 52, boxTop + 17, { width: 40 });
    doc.font('Helvetica-Bold').fontSize(7).fillColor(scoreColor(overallScore))
        .text(scoreLabel, PAGE_MARGIN + USABLE_WIDTH - 110, boxTop + 44, { width: 98, align: 'right', characterSpacing: 0.8 });

    // Severity breakdown row
    const brkY = boxTop + 60;
    const brkParts: [string, number, string][] = [
        [`CRITICAL: ${breakdown.critical}`, breakdown.critical, COLOR.red],
        [`HIGH: ${breakdown.high}`,         breakdown.high,     COLOR.orange],
        [`MEDIUM: ${breakdown.medium}`,     breakdown.medium,   COLOR.yellow],
        [`LOW: ${breakdown.low}`,           breakdown.low,      COLOR.blue],
        [`INFO: ${breakdown.info}`,         breakdown.info,     COLOR.muted],
    ];
    let brkX = PAGE_MARGIN + 12;
    brkParts.forEach(([label, , color]) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(color)
            .text(label, brkX, brkY, { width: 78, lineBreak: false });
        brkX += 80;
    });

    // Metrics grid — 3 columns
    const metricCol = (USABLE_WIDTH - 120) / 3; // leave room for score on right
    const metrics: [string, string][] = [
        ['Status',           testRun.status],
        ['Total Endpoints',  String(testRun.totalEndpoints)],
        ['Total Attacks',    String(testRun.totalAttacks)],
        ['Critical Failures',String(criticalFailures)],
        ['Average Latency',  `${avgLatency} ms`],
        ['Risk Level',       scoreLabel],
    ];

    metrics.forEach(([label, value], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = PAGE_MARGIN + 12 + col * metricCol;
        const y = boxTop + 12 + row * 34;

        doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted)
            .text(label.toUpperCase(), x, y, { width: metricCol - 16, characterSpacing: 0.5 });
        doc.font('Helvetica-Bold').fontSize(12)
            .fillColor(label === 'Critical Failures' ? scoreColor(overallScore) : COLOR.black)
            .text(value, x, y + 11, { width: metricCol - 16 });
    });

    doc.y = boxTop + boxHeight + 20;

    // ================================================================
    // 3. ATTACK RESULTS TABLE
    // ================================================================
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLOR.black)
        .text('ATTACK RESULTS', PAGE_MARGIN, doc.y, { characterSpacing: 1 });

    doc.moveDown(0.4);
    drawHRule(doc, doc.y);
    doc.moveDown(0.6);

    // Table header
    const tableHeaderY = doc.y;
    doc.rect(PAGE_MARGIN, tableHeaderY, USABLE_WIDTH, 18).fill(COLOR.headerBg);

    const headers: [string, number][] = [
        ['METHOD',      COL.method],
        ['ENDPOINT',    COL.endpoint],
        ['ATTACK TYPE', COL.attackType],
        ['STATUS',      COL.statusCode],
        ['LATENCY',     COL.latency],
        ['SEVERITY',    COL.severity],
        ['RESULT',      COL.result],
    ];

    let headerX = PAGE_MARGIN + 6;
    headers.forEach(([label, width]) => {
        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.white)
            .text(label, headerX, tableHeaderY + 5, { width: width - 6, characterSpacing: 0.4 });
        headerX += width;
    });

    doc.y = tableHeaderY + 18;

    const ROW_HEIGHT = 16;

    sortedLogs.forEach((log, i) => {
        if (doc.y + ROW_HEIGHT > doc.page.height - 80) {
            doc.addPage();
            doc.y = PAGE_MARGIN;
        }

        const rowY = doc.y;
        if (i % 2 === 1) {
            doc.rect(PAGE_MARGIN, rowY, USABLE_WIDTH, ROW_HEIGHT).fill(COLOR.rowAlt);
        }

        const code = log.statusCode ?? 0;
        const cells: [string, number, string][] = [
            [log.method,                           COL.method,     '#3b82f6'],
            [truncate(log.path, 30),               COL.endpoint,   COLOR.black],
            [truncate(log.attackType, 16),         COL.attackType, COLOR.muted],
            [code > 0 ? String(code) : 'ERR',     COL.statusCode, resultColor(code)],
            [`${log.latencyMs ?? 0}ms`,            COL.latency,    COLOR.muted],
            [log.severity,                         COL.severity,   severityColor(log.severity)],
            [resultLabel(code),                    COL.result,     resultColor(code)],
        ];

        let cellX = PAGE_MARGIN + 6;
        cells.forEach(([text, width, color]) => {
            doc.font('Helvetica').fontSize(7.5).fillColor(color)
                .text(text, cellX, rowY + 4, { width: width - 8, lineBreak: false });
            cellX += width;
        });

        doc.moveTo(PAGE_MARGIN, rowY + ROW_HEIGHT)
            .lineTo(PAGE_MARGIN + USABLE_WIDTH, rowY + ROW_HEIGHT)
            .strokeColor(COLOR.border).lineWidth(0.3).stroke();

        doc.y = rowY + ROW_HEIGHT;
    });

    if (sortedLogs.length === 0) {
        doc.font('Helvetica').fontSize(9).fillColor(COLOR.muted)
            .text('No attack logs recorded for this test run.', PAGE_MARGIN, doc.y + 8);
        doc.moveDown(1);
    }

    // ================================================================
    // 4. FOOTER (every page)
    // ================================================================
    const totalPages = doc.bufferedPageRange().count;
    for (let p = 0; p < totalPages; p++) {
        doc.switchToPage(p);
        const footerY = doc.page.height - 36;
        doc.rect(0, footerY, PAGE_WIDTH, 36).fill(COLOR.headerBg);
        doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted)
            .text(
                `Generated by Onyx Security Platform  ·  ${generatedAt.toUTCString()}  ·  Page ${p + 1} of ${totalPages}`,
                PAGE_MARGIN, footerY + 12,
                { width: USABLE_WIDTH, align: 'center' },
            );
    }

    doc.end();
    await endPromise;
    return Buffer.concat(chunks);
}
