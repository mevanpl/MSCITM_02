const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const PORT = process.env.API_PORT || 3001;
const DB_PATH = path.join(__dirname, "db.json");

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Shelton Tool-Hire API",
    version: "1.0.0",
    description: "API for the Shelton Tool-Hire catalogue, reviews, and admin actions.",
  },
  servers: [{ url: `http://localhost:${PORT}` }],
  tags: [
    { name: "Data", description: "Combined database reads" },
    { name: "Categories", description: "Equipment categories" },
    { name: "Tools", description: "Equipment catalogue management" },
    { name: "Reviews", description: "Customer review moderation and replies" },
  ],
  paths: {
    "/api/data": {
      get: {
        tags: ["Data"],
        summary: "Get all application data",
        responses: {
          200: {
            description: "All categories, tools, and reviews",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Database" } } },
          },
        },
      },
    },
    "/api/categories": {
      get: {
        tags: ["Categories"],
        summary: "List categories",
        responses: {
          200: {
            description: "Category list",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Category" } } } },
          },
        },
      },
      post: {
        tags: ["Categories"],
        summary: "Create a category",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryInput" } } },
        },
        responses: {
          201: {
            description: "Created category",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Category" } } },
          },
          400: { description: "Validation error" },
        },
      },
    },
    "/api/categories/{id}": {
      patch: {
        tags: ["Categories"],
        summary: "Update a category",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", example: "building" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryInput" } } },
        },
        responses: {
          200: {
            description: "Updated category",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Category" } } },
          },
          404: { description: "Category not found" },
        },
      },
    },
    "/api/tools": {
      get: {
        tags: ["Tools"],
        summary: "List tools",
        responses: {
          200: {
            description: "Tool list",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Tool" } } } },
          },
        },
      },
      post: {
        tags: ["Tools"],
        summary: "Create a tool",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ToolInput" } } },
        },
        responses: {
          201: {
            description: "Created tool",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Tool" } } },
          },
          400: { description: "Validation error" },
        },
      },
    },
    "/api/tools/{id}": {
      patch: {
        tags: ["Tools"],
        summary: "Update a tool",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ToolUpdate" } } },
        },
        responses: {
          200: {
            description: "Updated tool",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Tool" } } },
          },
          404: { description: "Tool not found" },
        },
      },
    },
    "/api/reviews": {
      get: {
        tags: ["Reviews"],
        summary: "List reviews",
        responses: {
          200: {
            description: "Review list",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Review" } } } },
          },
        },
      },
      post: {
        tags: ["Reviews"],
        summary: "Submit a customer review",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewInput" } } },
        },
        responses: {
          201: {
            description: "Created pending review",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Review" } } },
          },
          400: { description: "Validation error" },
        },
      },
    },
    "/api/reviews/{id}": {
      patch: {
        tags: ["Reviews"],
        summary: "Moderate a review",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { status: { type: "string", enum: ["approved", "pending"] } },
                required: ["status"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Updated review",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Review" } } },
          },
          404: { description: "Review not found" },
        },
      },
      delete: {
        tags: ["Reviews"],
        summary: "Delete a review",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          204: { description: "Review deleted" },
          404: { description: "Review not found" },
        },
      },
    },
    "/api/reviews/{id}/comments": {
      post: {
        tags: ["Reviews"],
        summary: "Add a comment or threaded reply to a review",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  author: { type: "string", example: "Alex P." },
                  text: { type: "string", example: "I had the same experience." },
                  parentId: { type: "integer", nullable: true, example: 12 },
                  isCompany: { type: "boolean", example: false },
                },
                required: ["text"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Review with added comment",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Review" } } },
          },
          400: { description: "Validation error" },
          404: { description: "Review not found" },
        },
      },
    },
  },
  components: {
    parameters: {
      Id: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "integer", example: 1 },
      },
    },
    schemas: {
      Database: {
        type: "object",
        properties: {
          categories: { type: "array", items: { $ref: "#/components/schemas/Category" } },
          tools: { type: "array", items: { $ref: "#/components/schemas/Tool" } },
          reviews: { type: "array", items: { $ref: "#/components/schemas/Review" } },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "string", example: "building" },
          label: { type: "string", example: "Building & Construction" },
          icon: { type: "string", example: "Build" },
          img: { type: "string", example: "/images/categories/building.svg" },
        },
      },
      CategoryInput: {
        type: "object",
        required: ["label"],
        properties: {
          id: { type: "string", example: "lifting" },
          label: { type: "string", example: "Lifting Equipment" },
          icon: { type: "string", example: "Lift" },
          img: { type: "string", example: "/images/categories/lifting.svg" },
        },
      },
      Tool: {
        allOf: [
          { type: "object", properties: { id: { type: "integer", example: 1 } } },
          { $ref: "#/components/schemas/ToolInput" },
        ],
      },
      ToolInput: {
        type: "object",
        required: ["name"],
        properties: {
          category: { type: "string", example: "building" },
          name: { type: "string", example: "Concrete Mixer 130L" },
          brand: { type: "string", example: "Belle" },
          img: { type: "string", example: "https://placehold.co/400x280" },
          hourly: { type: "number", example: 8.5 },
          daily: { type: "number", example: 32 },
          weekly: { type: "number", example: 95 },
          desc: { type: "string", example: "Heavy-duty electric concrete mixer." },
          specs: { type: "array", items: { type: "string" }, example: ["130L drum capacity", "550W motor"] },
        },
      },
      ToolUpdate: {
        type: "object",
        properties: {
          category: { type: "string" },
          name: { type: "string" },
          brand: { type: "string" },
          img: { type: "string" },
          hourly: { type: "number" },
          daily: { type: "number" },
          weekly: { type: "number" },
          desc: { type: "string" },
          specs: { type: "array", items: { type: "string" } },
        },
      },
      Ratings: {
        type: "object",
        required: ["performance", "service", "support", "aftersales", "misc"],
        properties: {
          performance: { type: "integer", minimum: 1, maximum: 5, example: 5 },
          service: { type: "integer", minimum: 1, maximum: 5, example: 4 },
          support: { type: "integer", minimum: 1, maximum: 5, example: 5 },
          aftersales: { type: "integer", minimum: 1, maximum: 5, example: 4 },
          misc: { type: "integer", minimum: 1, maximum: 5, example: 5 },
        },
      },
      Comment: {
        type: "object",
        properties: {
          id: { type: "integer", example: 12 },
          parentId: { type: "integer", nullable: true, example: null },
          author: { type: "string", example: "Shelton Tool-Hire" },
          text: { type: "string", example: "Thanks for your review." },
          isCompany: { type: "boolean", example: true },
          date: { type: "string", format: "date", example: "2026-05-17" },
        },
      },
      Review: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          toolId: { type: "integer", example: 1 },
          author: { type: "string", example: "James T." },
          date: { type: "string", format: "date", example: "2024-11-12" },
          ratings: { $ref: "#/components/schemas/Ratings" },
          body: { type: "string", example: "Excellent mixer, ran all day." },
          status: { type: "string", enum: ["approved", "pending"], example: "approved" },
          comments: { type: "array", items: { $ref: "#/components/schemas/Comment" } },
        },
      },
      ReviewInput: {
        type: "object",
        required: ["toolId", "author", "body", "ratings"],
        properties: {
          toolId: { type: "integer", example: 1 },
          author: { type: "string", example: "James T." },
          ratings: { $ref: "#/components/schemas/Ratings" },
          body: { type: "string", example: "Excellent mixer, ran all day." },
        },
      },
    },
  },
};

function swaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shelton Tool-Hire API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui"
        });
      };
    </script>
  </body>
</html>`;
}

async function readDb() {
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res, status, data) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  res.end(data === null ? "" : JSON.stringify(data));
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/html; charset=utf-8",
  });
  res.end(html);
}

function notFound(res) {
  send(res, 404, { error: "Not found" });
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function nextCommentId(reviews) {
  return reviews.reduce((max, review) => {
    return Math.max(max, ...(review.comments || []).map((comment) => Number(comment.id) || 0));
  }, 0) + 1;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return send(res, 204, null);

    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET" && url.pathname === "/openapi.json") {
      return send(res, 200, openApiSpec);
    }

    if (req.method === "GET" && (url.pathname === "/api-docs" || url.pathname === "/api-docs/")) {
      return sendHtml(res, 200, swaggerHtml());
    }

    if (parts[0] !== "api") return notFound(res);

    if (req.method === "GET" && parts[1] === "data" && parts.length === 2) {
      return send(res, 200, await readDb());
    }

    if (req.method === "GET" && ["categories", "tools", "reviews"].includes(parts[1]) && parts.length === 2) {
      const db = await readDb();
      return send(res, 200, db[parts[1]]);
    }

    if (req.method === "POST" && parts[1] === "categories" && parts.length === 2) {
      const db = await readDb();
      const body = await readBody(req);
      const label = String(body.label || "").trim();
      const id = String(body.id || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")).trim();
      const category = {
        id,
        label,
        icon: String(body.icon || label.slice(0, 2) || "CT").trim(),
        img: String(body.img || "/images/categories/category-placeholder.svg").trim(),
      };

      if (!category.id || !category.label) return send(res, 400, { error: "Category label is required" });
      if (db.categories.some((item) => item.id === category.id)) return send(res, 400, { error: "Category already exists" });

      db.categories.push(category);
      await writeDb(db);
      return send(res, 201, category);
    }

    if (req.method === "PATCH" && parts[1] === "categories" && parts.length === 3) {
      const db = await readDb();
      const id = parts[2];
      const body = await readBody(req);
      const category = db.categories.find((item) => item.id === id);
      if (!category) return notFound(res);

      if (body.label !== undefined) category.label = String(body.label || "").trim();
      if (body.icon !== undefined) category.icon = String(body.icon || "").trim();
      if (body.img !== undefined) category.img = String(body.img || "/images/categories/category-placeholder.svg").trim();
      if (!category.label) return send(res, 400, { error: "Category label is required" });

      await writeDb(db);
      return send(res, 200, category);
    }

    if (req.method === "POST" && parts[1] === "reviews" && parts.length === 2) {
      const db = await readDb();
      const body = await readBody(req);
      const review = {
        id: nextId(db.reviews),
        toolId: Number(body.toolId),
        author: String(body.author || "").trim(),
        date: new Date().toISOString().slice(0, 10),
        ratings: body.ratings || {},
        body: String(body.body || "").trim(),
        status: "pending",
        comments: [],
      };

      if (!review.toolId || !review.author || !review.body) {
        return send(res, 400, { error: "toolId, author, and body are required" });
      }

      db.reviews.push(review);
      await writeDb(db);
      return send(res, 201, review);
    }

    if (req.method === "PATCH" && parts[1] === "reviews" && parts.length === 3) {
      const db = await readDb();
      const id = Number(parts[2]);
      const body = await readBody(req);
      const review = db.reviews.find((item) => item.id === id);
      if (!review) return notFound(res);

      if (body.status) review.status = body.status;
      await writeDb(db);
      return send(res, 200, review);
    }

    if (req.method === "DELETE" && parts[1] === "reviews" && parts.length === 3) {
      const db = await readDb();
      const id = Number(parts[2]);
      const index = db.reviews.findIndex((item) => item.id === id);
      if (index === -1) return notFound(res);

      db.reviews.splice(index, 1);
      await writeDb(db);
      return send(res, 204, null);
    }

    if (req.method === "POST" && parts[1] === "reviews" && parts[3] === "comments" && parts.length === 4) {
      const db = await readDb();
      const id = Number(parts[2]);
      const body = await readBody(req);
      const review = db.reviews.find((item) => item.id === id);
      if (!review) return notFound(res);

      const parentId = body.parentId === undefined || body.parentId === null ? null : Number(body.parentId);
      const comment = {
        id: nextCommentId(db.reviews),
        parentId,
        author: String(body.author || "Shelton Tool-Hire").trim(),
        text: String(body.text || "").trim(),
        isCompany: Boolean(body.isCompany),
        date: new Date().toISOString().slice(0, 10),
      };

      if (!comment.author) return send(res, 400, { error: "Comment author is required" });
      if (!comment.text) return send(res, 400, { error: "Comment text is required" });
      if (parentId && !review.comments.some((item) => Number(item.id) === parentId)) {
        return send(res, 400, { error: "Parent comment was not found" });
      }

      review.comments.push(comment);
      await writeDb(db);
      return send(res, 200, review);
    }

    if (req.method === "POST" && parts[1] === "tools" && parts.length === 2) {
      const db = await readDb();
      const body = await readBody(req);
      const tool = {
        id: nextId(db.tools),
        category: body.category || "building",
        name: String(body.name || "").trim(),
        brand: String(body.brand || "").trim(),
        img: body.img || "/images/products/product-placeholder.svg",
        hourly: Number(body.hourly) || 0,
        daily: Number(body.daily) || 0,
        weekly: Number(body.weekly) || 0,
        desc: String(body.desc || "").trim(),
        specs: Array.isArray(body.specs) ? body.specs : [],
      };

      if (!tool.name) return send(res, 400, { error: "Tool name is required" });

      db.tools.push(tool);
      await writeDb(db);
      return send(res, 201, tool);
    }

    if (req.method === "PATCH" && parts[1] === "tools" && parts.length === 3) {
      const db = await readDb();
      const id = Number(parts[2]);
      const body = await readBody(req);
      const tool = db.tools.find((item) => item.id === id);
      if (!tool) return notFound(res);

      for (const field of ["name", "brand", "category", "desc", "img"]) {
        if (body[field] !== undefined) tool[field] = body[field];
      }
      for (const field of ["hourly", "daily", "weekly"]) {
        if (body[field] !== undefined && !Number.isNaN(Number(body[field]))) {
          tool[field] = Number(body[field]);
        }
      }
      if (Array.isArray(body.specs)) tool.specs = body.specs;

      await writeDb(db);
      return send(res, 200, tool);
    }

    return notFound(res);
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
