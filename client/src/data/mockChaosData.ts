export interface ChaosResult {
  id: number;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  statusCode: number;
  responseTime: number;
  payload: string;
}

export const mockChaosData: ChaosResult[] = [
  {
    id: 1,
    method: "POST",
    endpoint: "/api/v1/users/login",
    statusCode: 500,
    responseTime: 2340,
    payload: "' OR 1=1; DROP TABLE users; --",
  },
  {
    id: 2,
    method: "GET",
    endpoint: "/api/v1/products?id=<script>alert(1)</script>",
    statusCode: 200,
    responseTime: 45,
    payload: "<script>alert('xss')</script>",
  },
  {
    id: 3,
    method: "POST",
    endpoint: "/api/v1/checkout",
    statusCode: 500,
    responseTime: 8920,
    payload: '{"items":[' + '"x",'.repeat(50000).slice(0, -1) + "]}",
  },
  {
    id: 4,
    method: "DELETE",
    endpoint: "/api/v1/admin/users/1",
    statusCode: 500,
    responseTime: 120,
    payload: "[No Authorization Header]",
  },
  {
    id: 5,
    method: "PUT",
    endpoint: "/api/v1/users/profile",
    statusCode: 200,
    responseTime: 88,
    payload: '{"role":"admin","is_superuser":true}',
  },
  {
    id: 6,
    method: "POST",
    endpoint: "/api/v1/upload",
    statusCode: 500,
    responseTime: 15200,
    payload: "[Binary: 500MB null-byte file]",
  },
  {
    id: 7,
    method: "GET",
    endpoint: "/api/v1/users/../../../etc/passwd",
    statusCode: 200,
    responseTime: 33,
    payload: "Path traversal attempt",
  },
  {
    id: 8,
    method: "PATCH",
    endpoint: "/api/v1/settings",
    statusCode: 500,
    responseTime: 670,
    payload: '{"debug_mode":true,"log_level":"TRACE"}',
  },
  {
    id: 9,
    method: "POST",
    endpoint: "/api/v1/graphql",
    statusCode: 200,
    responseTime: 4500,
    payload: '{query:"{__schema{types{name fields{name}}}}"}',
  },
  {
    id: 10,
    method: "GET",
    endpoint: "/api/v1/health?callback=evil",
    statusCode: 500,
    responseTime: 190,
    payload: "JSONP injection via callback param",
  },
];
