import express from "express";

const app = express();
app.use(express.json());

const MAIL_API = "https://api.mail.tm";

// Proxy helper
const proxyRequest = async (req: express.Request, res: express.Response, path: string, method: string = "GET") => {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (req.headers.authorization) {
      headers["Authorization"] = req.headers.authorization;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (["POST", "PUT", "PATCH"].includes(method) && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(`${MAIL_API}${path}`, options);
    
    // Handle non-JSON responses (like 204 No Content)
    if (response.status === 204) {
      return res.status(204).send();
    }

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    console.error(`Proxy error for ${path}:`, error);
    res.status(500).json({ error: "Failed to fetch from mail service", details: error.message });
  }
};

// API Routes
app.get("/api/mail/domains", (req, res) => proxyRequest(req, res, "/domains"));
app.post("/api/mail/accounts", (req, res) => proxyRequest(req, res, "/accounts", "POST"));
app.post("/api/mail/token", (req, res) => proxyRequest(req, res, "/token", "POST"));
app.get("/api/mail/messages", (req, res) => proxyRequest(req, res, "/messages"));
app.get("/api/mail/messages/:id", (req, res) => proxyRequest(req, res, `/messages/${req.params.id}`));
app.delete("/api/mail/messages/:id", (req, res) => proxyRequest(req, res, `/messages/${req.params.id}`, "DELETE"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "KAS Temp Mail Proxy" });
});

export default app;
