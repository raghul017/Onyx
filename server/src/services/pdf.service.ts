import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const PAGE_MARGIN = 50;
const PAGE_WIDTH = 612; // US Letter
const USABLE_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

// Column widths for the attack results table (must sum to USABLE_WIDTH = 512)
const COL = {
    method:     55,
    endpoint:  175,
    attackType: 90,
    statusCode: 65,
    latency:    55,
    result:     72,
};

// Palette
const COLOR = {
    black:       '#000000',
    white:       '#FFFFFF',
    accent:      '#06b6d4', // cyan-500
    headerBg:    '#0a0a0a',
    rowAlt:      '#f8f8f8',
    red:         '#ef4444',
    orange:      '#f97316',
    green:       '#22c55e',
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

function riskLabel(criticalFailures: number): string {
    if (criticalFailures > 10) return 'CRITICAL';
    if (criticalFailures >= 5) return 'HIGH';
    if (criticalFailures >= 1) return 'MEDIUM';
    return 'CLEAN';
}

function riskColor(criticalFailures: number): string {
    if (criticalFailures > 10) return COLOR.red;
    if (criticalFailures >= 5) return COLOR.orange;
    if (criticalFailures >= 1) return '#eab308'; // yellow
    return COLOR.green;
}

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
    const criticalFailures = logs.filter(l => (l.statusCode ?? 0) >= 500).length;
    const totalLatency = logs.reduce((s, l) => s + (l.latencyMs ?? 0), 0);
    const avgLatency = logs.length > 0 ? Math.round(totalLatency / logs.length) : 0;

    // Sort: VULNERABLE → SUSPICIOUS → PASS
    const sortedLogs = [...logs].sort((a, b) => {
        const rank = (code: number | null) => {
            if ((code ?? 0) >= 500) return 0;
            if ((code ?? 0) >= 400) return 1;
            return 2;
        };
        return rank(a.statusCode) - rank(b.statusCode);
    });

    const generatedAt = new Date();

    // ---- Build PDF ----
    const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'LETTER', bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const endPromise = new Promise<void>(resolve => doc.on('end', resolve));

    // ================================================================
    // 1. HEADER
    // ================================================================
    // Dark background bar
    doc.rect(0, 0, PAGE_WIDTH, 90).fill(COLOR.headerBg);

    doc.fillColor(COLOR.accent)
        .font('Helvetica-Bold')
        .fontSize(22)
        .text('ONYX', PAGE_MARGIN, 22, { continued: true })
        .fillColor(COLOR.white)
        .font('Helvetica')
        .fontSize(22)
        .text(' Security Report');

    doc.fillColor(COLOR.muted)
        .font('Helvetica')
        .fontSize(8)
        .text(
            `Run ID: ${testRun.id}   ·   Generated: ${generatedAt.toUTCString()}`,
            PAGE_MARGIN, 52,
        );

    doc.fillColor('#94a3b8')
        .fontSize(8)
        .text(`Target: ${truncate(testRun.specUrl, 90)}`, PAGE_MARGIN, 66);

    doc.y = 110;

    // ================================================================
    // 2. EXECUTIVE SUMMARY
    // ================================================================
    doc.fillColor(COLOR.black)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('EXECUTIVE SUMMARY', PAGE_MARGIN, doc.y, { characterSpacing: 1 });

    doc.moveDown(0.4);
    drawHRule(doc, doc.y);
    doc.moveDown(0.6);

    // Summary box
    const boxTop = doc.y;
    const boxHeight = 80;
    doc.rect(PAGE_MARGIN, boxTop, USABLE_WIDTH, boxHeight)
        .fill(COLOR.sectionBg)
        .stroke();
    doc.strokeColor(COLOR.border).lineWidth(1)
        .rect(PAGE_MARGIN, boxTop, USABLE_WIDTH, boxHeight).stroke();

    // Risk label — right-aligned inside box
    const risk = riskLabel(criticalFailures);
    doc.font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(riskColor(criticalFailures))
        .text(risk, PAGE_MARGIN + USABLE_WIDTH - 100, boxTop + 12, { width: 90, align: 'right' });

    // Metrics grid — 3 columns
    const metricCol = USABLE_WIDTH / 3;
    const metrics: [string, string][] = [
        ['Status',            testRun.status],
        ['Total Endpoints',   String(testRun.totalEndpoints)],
        ['Total Attacks',     String(testRun.totalAttacks)],
        ['Critical Failures', String(criticalFailures)],
        ['Average Latency',   `${avgLatency} ms`],
        ['Risk Level',        risk],
    ];

    metrics.forEach(([label, value], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = PAGE_MARGIN + 12 + col * metricCol;
        const y = boxTop + 12 + row * 34;

        doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted)
            .text(label.toUpperCase(), x, y, { width: metricCol - 16, characterSpacing: 0.5 });
        doc.font('Helvetica-Bold').fontSize(12)
            .fillColor(label === 'Critical Failures' ? riskColor(criticalFailures) : COLOR.black)
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

    // Table header row
    const tableHeaderY = doc.y;
    doc.rect(PAGE_MARGIN, tableHeaderY, USABLE_WIDTH, 18).fill(COLOR.headerBg);

    const headers: [string, number][] = [
        ['METHOD',      COL.method],
        ['ENDPOINT',    COL.endpoint],
        ['ATTACK TYPE', COL.attackType],
        ['STATUS',      COL.statusCode],
        ['LATENCY',     COL.latency],
        ['RESULT',      COL.result],
    ];

    let headerX = PAGE_MARGIN + 6;
    headers.forEach(([label, width]) => {
        doc.font('Helvetica-Bold').fontSize(7).fillColor(COLOR.white)
            .text(label, headerX, tableHeaderY + 5, { width: width - 6, characterSpacing: 0.4 });
        headerX += width;
    });

    doc.y = tableHeaderY + 18;

    // Table rows
    const ROW_HEIGHT = 16;

    sortedLogs.forEach((log, i) => {
        // Add new page if we're running out of space
        if (doc.y + ROW_HEIGHT > doc.page.height - 80) {
            doc.addPage();
            doc.y = PAGE_MARGIN;
        }

        const rowY = doc.y;
        const isAlt = i % 2 === 1;

        if (isAlt) {
            doc.rect(PAGE_MARGIN, rowY, USABLE_WIDTH, ROW_HEIGHT).fill(COLOR.rowAlt);
        }

        const code = log.statusCode ?? 0;
        const cells: [string, number, string][] = [
            [log.method,                             COL.method,     '#3b82f6'],
            [truncate(log.path, 32),                 COL.endpoint,   COLOR.black],
            [truncate(log.attackType, 18),           COL.attackType, COLOR.muted],
            [code > 0 ? String(code) : 'ERR',       COL.statusCode, resultColor(code)],
            [`${log.latencyMs ?? 0}ms`,              COL.latency,    COLOR.muted],
            [resultLabel(code),                      COL.result,     resultColor(code)],
        ];

        let cellX = PAGE_MARGIN + 6;
        cells.forEach(([text, width, color]) => {
            doc.font('Helvetica').fontSize(7.5).fillColor(color)
                .text(text, cellX, rowY + 4, { width: width - 8, lineBreak: false });
            cellX += width;
        });

        // Bottom border
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
    // 4. FOOTER (on every page)
    // ================================================================
    const totalPages = (doc.bufferedPageRange().count);
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
