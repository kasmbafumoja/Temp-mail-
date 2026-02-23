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

    const text = await response.text();
    if (!text) {
      return res.status(response.status).send();
    }

    try {
      // Try to parse as JSON if possible
      const data = JSON.parse(text);
      res.status(response.status).json(data);
    } catch (e) {
      // If not JSON, send as plain text
      res.status(response.status).send(text);
    }
  } catch (error: any) {
    console.error(`Proxy error for ${path}:`, error);
    res.status(500).json({ error: "Failed to fetch from mail service", details: error.message });
  }
};

// API Routes
// We use a regex to match routes with or without the /api prefix
const router = express.Router();

router.get("/mail/domains", (req, res) => proxyRequest(req, res, "/domains"));
router.post("/mail/accounts", (req, res) => proxyRequest(req, res, "/accounts", "POST"));
router.post("/mail/token", (req, res) => proxyRequest(req, res, "/token", "POST"));
router.get("/mail/messages", (req, res) => proxyRequest(req, res, "/messages"));
router.get("/mail/messages/:id", (req, res) => proxyRequest(req, res, `/messages/${req.params.id}`));
router.delete("/mail/messages/:id", (req, res) => proxyRequest(req, res, `/messages/${req.params.id}`, "DELETE"));

router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "KAS Temp Mail Proxy" });
});

// Mount the router on both /api and / for maximum compatibility
app.use("/api", router);
app.use("/", router);

export default app;
