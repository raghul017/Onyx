// =============================================================================
// Framework-specific remediation snippets (T15a).
//
// CURATED ONLY — no LLM, no generation. Every snippet uses a canonical, real API
// of the named framework/library. Where a correct, idiomatic fix could not be
// stated confidently and briefly, the cell is deliberately OMITTED so the UI
// falls back to the finding's own generic remediation text. A missing cell is
// always better than plausible-looking but wrong security advice.
//
// Keys MUST match the backend's finding `category` strings verbatim — see
// server/src/services/finding-analysis.ts and the BOLA/BFLA/mass-assignment/
// data-exposure verdict services.
// =============================================================================

export type Framework = "express" | "fastapi" | "spring" | "django";

export const FRAMEWORKS: { id: Framework; label: string }[] = [
    { id: "express", label: "Express" },
    { id: "fastapi", label: "FastAPI" },
    { id: "spring", label: "Spring" },
    { id: "django", label: "Django" },
];

export interface RemediationSnippet {
    /** One-line framing shown above the code. */
    summary: string;
    /** Short, copy-paste-oriented code. */
    code: string;
    /** Language hint (display only). */
    language: string;
}

type CategoryMap = Partial<Record<Framework, RemediationSnippet>>;

// ---------------------------------------------------------------------------
// The library: category → framework → snippet
// ---------------------------------------------------------------------------
export const REMEDIATION: Record<string, CategoryMap> = {
    // -- Injection --------------------------------------------------------
    "SQL Injection": {
        express: {
            summary:
                "Use a parameterized query — never concatenate input into SQL. The driver sends values separately from the statement.",
            language: "js",
            code: `// pg (node-postgres) — $1 placeholders, values passed separately
const { rows } = await client.query(
  'SELECT id, email FROM users WHERE id = $1',
  [req.params.id],
);

// mysql2 — ? placeholders
const [rows] = await conn.execute(
  'SELECT id, email FROM users WHERE id = ?',
  [req.params.id],
);`,
        },
        fastapi: {
            summary:
                "Bind parameters instead of formatting them into the SQL string. With SQLAlchemy, use bound parameters or the ORM.",
            language: "python",
            code: `from sqlalchemy import text

# Bound parameters — the value never becomes part of the statement
result = await session.execute(
    text("SELECT id, email FROM users WHERE id = :user_id"),
    {"user_id": user_id},
)

# Or use the ORM, which parameterizes for you
user = await session.get(User, user_id)`,
        },
        spring: {
            summary:
                "Use a prepared statement via JdbcTemplate placeholders, or a derived/@Query repository method — both bind parameters.",
            language: "java",
            code: `// JdbcTemplate — ? placeholders, args bound separately
List<User> users = jdbcTemplate.query(
    "SELECT id, email FROM users WHERE id = ?",
    new Object[]{ id },
    userRowMapper);

// Spring Data JPA — named parameters are bound, not interpolated
@Query("SELECT u FROM User u WHERE u.id = :id")
Optional<User> findById(@Param("id") Long id);`,
        },
        django: {
            summary:
                "Use the ORM (which always parameterizes) or, for raw SQL, pass params separately — never use string formatting.",
            language: "python",
            code: `# ORM — parameterized automatically
user = User.objects.get(pk=user_id)

# Raw SQL — pass params as a list, never f-strings/%
User.objects.raw("SELECT * FROM users WHERE id = %s", [user_id])

with connection.cursor() as cursor:
    cursor.execute("SELECT email FROM users WHERE id = %s", [user_id])`,
        },
    },

    // Blind/time-based injection has the SAME root cause + fix as SQL injection.
    "Blind/Time-Based Injection": {
        express: {
            summary:
                "Same root cause as SQL injection: input reaches the query engine. Parameterize, and add a server-side query timeout.",
            language: "js",
            code: `// Parameterize (pg) — the payload can never alter the statement
const { rows } = await client.query(
  'SELECT id FROM users WHERE email = $1',
  [req.body.email],
);

// Defense in depth: cap how long any statement may run
// (pg connection option)
const pool = new Pool({ statement_timeout: 5000 });`,
        },
        django: {
            summary:
                "Same root cause as SQL injection. Use the ORM / parameter binding; never interpolate input into raw SQL.",
            language: "python",
            code: `# Parameterized — the delay payload is treated as a value, not SQL
User.objects.filter(email=request.GET["email"])

with connection.cursor() as cursor:
    cursor.execute("SELECT id FROM users WHERE email = %s", [email])`,
        },
    },

    "Reflected XSS": {
        express: {
            summary:
                "Return JSON (not interpolated HTML) and escape any value rendered into a template. Set a restrictive CSP.",
            language: "js",
            code: `// Return data as JSON — res.json escapes nothing into HTML context
res.json({ query: req.query.q });

// If you DO render HTML, use a template engine that auto-escapes
// (EJS <%= %>, Pug #{}) — never build HTML with string concatenation.

// Defense in depth: a CSP that blocks inline script
import helmet from 'helmet';
app.use(helmet.contentSecurityPolicy({
  directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"] },
}));`,
        },
        django: {
            summary:
                "Django templates auto-escape by default — keep it that way. Never mark untrusted input safe.",
            language: "python",
            code: `# Templates auto-escape: {{ user_input }} is safe by default.
# NEVER do this with untrusted data:
#   {{ user_input|safe }}
#   mark_safe(user_input)

# For JSON-ish data in a template, use the built-in tag:
# {{ value|json_script:"my-data" }}`,
        },
    },

    "Path Traversal": {
        express: {
            summary:
                "Resolve the path and confirm it stays inside an allow-listed base directory before reading it.",
            language: "js",
            code: `import path from 'node:path';

const BASE = path.resolve('/var/app/uploads');
const target = path.resolve(BASE, req.params.file);

// Reject anything that escapes the base dir (covers ../ and encoded variants)
if (!target.startsWith(BASE + path.sep)) {
  return res.status(400).json({ error: 'Invalid path' });
}
res.sendFile(target);`,
        },
        fastapi: {
            summary:
                "Resolve the path and verify it is contained by the allow-listed base directory.",
            language: "python",
            code: `from pathlib import Path
from fastapi import HTTPException

BASE = Path("/var/app/uploads").resolve()

target = (BASE / filename).resolve()
# is_relative_to() rejects ../ escapes (Python 3.9+)
if not target.is_relative_to(BASE):
    raise HTTPException(status_code=400, detail="Invalid path")`,
        },
    },

    // -- AuthN / AuthZ ------------------------------------------------------
    "Broken Authentication / Access Control": {
        express: {
            summary:
                "Require authentication in middleware applied to the router, so a new route cannot forget it.",
            language: "js",
            code: `// Verify the session/JWT once, for every route on the router
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Deny by default: mount it on the whole router, not per-handler
router.use(requireAuth);`,
        },
        fastapi: {
            summary:
                "Attach the auth dependency to the router so every route inherits it.",
            language: "python",
            code: `from fastapi import APIRouter, Depends, HTTPException, status

async def current_user(token: str = Depends(oauth2_scheme)):
    user = await decode_and_load(token)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized")
    return user

# Deny by default: every route on this router requires auth
router = APIRouter(dependencies=[Depends(current_user)])`,
        },
        spring: {
            summary:
                "Deny by default in the security filter chain; permit only what is explicitly public.",
            language: "java",
            code: `@Bean
SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.authorizeHttpRequests(auth -> auth
        .requestMatchers("/health", "/login").permitAll()
        .anyRequest().authenticated()   // deny by default
    );
    return http.build();
}`,
        },
        django: {
            summary:
                "Require authentication globally in DRF, then opt specific views out — not the other way round.",
            language: "python",
            code: `# settings.py — authenticated by default for every DRF view
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# Opt a specific view out explicitly:
# permission_classes = [AllowAny]`,
        },
    },

    "Broken Object Level Authorization": {
        express: {
            summary:
                "After loading the object, verify the authenticated caller owns it — an id in the URL is not authorization.",
            language: "js",
            code: `const doc = await Order.findById(req.params.id);
if (!doc) return res.status(404).json({ error: 'Not found' });

// The ownership check — without this, any valid id returns any user's data
if (doc.ownerId !== req.user.id) {
  return res.status(404).json({ error: 'Not found' }); // 404 avoids leaking existence
}
res.json(doc);

// Better: make ownership part of the query itself
const scoped = await Order.findOne({ _id: req.params.id, ownerId: req.user.id });`,
        },
        fastapi: {
            summary:
                "Scope the lookup to the caller, so another user's id simply returns nothing.",
            language: "python",
            code: `from fastapi import HTTPException

# Ownership is part of the QUERY — not an afterthought
order = await session.scalar(
    select(Order).where(Order.id == order_id, Order.owner_id == user.id)
)
if order is None:
    raise HTTPException(status_code=404, detail="Not found")
return order`,
        },
        django: {
            summary:
                "Filter the queryset by the requesting user so object lookups can't cross tenants.",
            language: "python",
            code: `class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer

    # Every detail/list lookup is scoped to the caller
    def get_queryset(self):
        return Order.objects.filter(owner=self.request.user)`,
        },
    },

    "Broken Function Level Authorization": {
        express: {
            summary:
                "Check the caller's role server-side on privileged routes — hiding the button in the UI is not a control.",
            language: "js",
            code: `function requireRole(role) {
  return (req, res, next) =>
    req.user?.roles?.includes(role)
      ? next()
      : res.status(403).json({ error: 'Forbidden' });
}

// Apply to the whole admin router so a new admin route can't forget it
adminRouter.use(requireAuth, requireRole('admin'));`,
        },
        spring: {
            summary:
                "Use method security so the authorization check lives with the privileged operation.",
            language: "java",
            code: `@EnableMethodSecurity   // on a @Configuration class

@PreAuthorize("hasRole('ADMIN')")
@DeleteMapping("/admin/users/{id}")
public void deleteUser(@PathVariable Long id) { ... }

// Or in the filter chain:
// .requestMatchers("/admin/**").hasRole("ADMIN")`,
        },
        fastapi: {
            summary:
                "Express the role requirement as a dependency on the privileged router.",
            language: "python",
            code: `from fastapi import APIRouter, Depends, HTTPException, status

def require_admin(user = Depends(current_user)):
    if "admin" not in user.roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    return user

admin = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])`,
        },
        django: {
            summary:
                "Enforce the role with a DRF permission class on the privileged viewset.",
            language: "python",
            code: `from rest_framework.permissions import BasePermission

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)

class AdminUserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]`,
        },
    },

    // -- Property-level (API3) ---------------------------------------------
    "Mass Assignment": {
        express: {
            summary:
                "Bind only an allow-list of client-writable fields — never spread the request body onto the model.",
            language: "js",
            code: `// NEVER: await User.create(req.body)  // client can set role/isAdmin

// Allow-list exactly what a client may set
const { name, email } = req.body;
const user = await User.create({
  name,
  email,
  role: 'user',            // set server-side, never from input
  ownerId: req.user.id,
});`,
        },
        fastapi: {
            summary:
                "Use a request model containing only client-writable fields; privileged fields live on a separate model.",
            language: "python",
            code: `from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str
    email: str
    # NOTE: no role / is_admin — clients cannot set them

@app.post("/users")
async def create_user(payload: UserCreate, ...):
    # Unknown/extra fields in the body are ignored, not bound
    user = User(**payload.model_dump(), role="user")`,
        },
        django: {
            summary:
                "List writable fields explicitly on the serializer and mark derived ones read-only.",
            language: "python",
            code: `class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Allow-list — never fields = "__all__"
        fields = ["id", "name", "email", "is_staff"]
        read_only_fields = ["id", "is_staff"]   # client cannot set these`,
        },
    },

    "Excessive Data Exposure": {
        express: {
            summary:
                "Serialize an explicit response shape instead of returning the whole database row.",
            language: "js",
            code: `const user = await User.findById(id);

// Return ONLY what the client needs — new columns can't leak later
res.json({
  id: user.id,
  name: user.name,
  email: user.email,
});

// (Mongoose alternative: select the fields you want)
// User.findById(id).select('id name email')`,
        },
        fastapi: {
            summary:
                "Declare a response_model — FastAPI filters the response down to those fields.",
            language: "python",
            code: `class UserOut(BaseModel):
    id: int
    name: str
    email: str
    # password_hash / ssn deliberately absent

@app.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: int):
    # Even if the ORM object has more fields, only UserOut's are returned
    return await load_user(user_id)`,
        },
        spring: {
            summary:
                "Return a DTO rather than the JPA entity, so persistence fields never reach the wire.",
            language: "java",
            code: `public record UserDto(Long id, String name, String email) {}

@GetMapping("/users/{id}")
public UserDto getUser(@PathVariable Long id) {
    User u = repo.findById(id).orElseThrow();
    return new UserDto(u.getId(), u.getName(), u.getEmail());
}`,
        },
        django: {
            summary:
                "Name the exposed fields on the serializer; never use `__all__` on a model with sensitive columns.",
            language: "python",
            code: `class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # Explicit allow-list — password, tokens, internal flags stay out
        fields = ["id", "name", "email"]`,
        },
    },

    "Sensitive Data Exposure": {
        express: {
            summary:
                "Keep secrets out of responses and logs; return an explicit field allow-list.",
            language: "js",
            code: `// Never return the raw record
const { id, name, email } = await User.findById(req.params.id);
res.json({ id, name, email });

// Mongoose: exclude by default at the schema level
// password: { type: String, select: false }`,
        },
        django: {
            summary:
                "Expose an explicit field list; never serialize credential columns.",
            language: "python",
            code: `class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "email"]   # password/tokens excluded`,
        },
    },

    // -- Error handling -----------------------------------------------------
    "Verbose Error / Info Disclosure": {
        express: {
            summary:
                "Return a generic message to the client and log the detail server-side only.",
            language: "js",
            code: `// Central error handler — LAST middleware
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled error');      // full detail stays server-side
  res.status(500).json({ error: 'Internal server error' }); // generic to client
});`,
        },
        fastapi: {
            summary:
                "Handle unexpected errors centrally and return a generic body; never run with debug on in production.",
            language: "python",
            code: `from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    logger.exception("Unhandled error")          # detail to logs only
    return JSONResponse(status_code=500,
                        content={"error": "Internal server error"})`,
        },
        django: {
            summary:
                "Turn off DEBUG in production — debug pages expose settings, SQL and stack traces.",
            language: "python",
            code: `# settings.py (production)
DEBUG = False
ALLOWED_HOSTS = ["api.example.com"]

# With DEBUG=False Django returns a plain 500 and logs the traceback.`,
        },
        spring: {
            summary:
                "Return a generic problem response and stop including the stack trace.",
            language: "java",
            code: `@RestControllerAdvice
class ErrorHandler {
    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> onError(Exception e) {
        log.error("Unhandled error", e);           // server-side only
        return ResponseEntity.status(500)
            .body(Map.of("error", "Internal server error"));
    }
}

# application.properties
server.error.include-stacktrace=never
server.error.include-message=never`,
        },
    },

    "Unhandled Server Error": {
        express: {
            summary:
                "Validate input at the boundary and catch errors centrally so malformed input yields a 4xx, not a crash.",
            language: "js",
            code: `import { z } from 'zod';

const Body = z.object({ email: z.string().email(), qty: z.number().int() });

app.post('/orders', (req, res, next) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request' });  // not a 500
  }
  // ...
});`,
        },
        fastapi: {
            summary:
                "Type the request body with Pydantic — FastAPI then returns a 422 for malformed input instead of erroring.",
            language: "python",
            code: `from pydantic import BaseModel, EmailStr

class OrderIn(BaseModel):
    email: EmailStr
    qty: int

@app.post("/orders")
async def create_order(order: OrderIn):
    # Malformed bodies are rejected with 422 before the handler runs
    ...`,
        },
    },
};

/**
 * Look up a snippet for a finding category + framework.
 * Returns null when no curated snippet exists — the caller then shows the
 * finding's own generic remediation text.
 */
export function getRemediationSnippet(
    category: string | undefined | null,
    framework: Framework | "generic",
): RemediationSnippet | null {
    if (!category || framework === "generic") return null;
    return REMEDIATION[category]?.[framework] ?? null;
}

/** Frameworks that have a snippet for this category (for enabling the picker). */
export function frameworksWithSnippet(category: string | undefined | null): Framework[] {
    if (!category) return [];
    const map = REMEDIATION[category];
    if (!map) return [];
    return FRAMEWORKS.map((f) => f.id).filter((id) => map[id] != null);
}
