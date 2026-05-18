import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:3001/api";

const REVIEW_FEATURES = [
  { id: "performance", label: "Equipment Performance" },
  { id: "service", label: "Customer Service" },
  { id: "support", label: "Technical Support" },
  { id: "aftersales", label: "After-Sales Support" },
  { id: "misc", label: "Overall Value" },
];

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function avgRating(review) {
  const vals = Object.values(review.ratings);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function toolAvgRating(toolId, reviews) {
  const approved = reviews.filter((r) => r.toolId === toolId && r.status === "approved");
  if (!approved.length) return null;
  return approved.reduce((sum, r) => sum + avgRating(r), 0) / approved.length;
}

function calcCost(tool, start, end) {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  if (ms <= 0) return null;

  const hours = ms / 3600000;
  const days = hours / 24;
  const weeks = days / 7;

  if (hours <= 4) return { amount: tool.hourly * hours, label: `${hours.toFixed(1)} hrs @ LKR ${tool.hourly}/hr` };
  if (days <= 7) return { amount: tool.daily * Math.ceil(days), label: `${Math.ceil(days)} day(s) @ LKR ${tool.daily}/day` };
  return { amount: tool.weekly * Math.ceil(weeks), label: `${Math.ceil(weeks)} week(s) @ LKR ${tool.weekly}/wk` };
}

function Stars({ rating, size = 16, interactive = false, onRate }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => interactive && onRate?.(s)}
          style={{
            color: s <= Math.round(rating) ? "#e67e22" : "#ccc",
            cursor: interactive ? "pointer" : "default",
            fontSize: size,
            lineHeight: 1,
          }}
        >
          *
        </span>
      ))}
    </span>
  );
}

function Badge({ children }) {
  return (
    <span
      style={{
        background: "#2c3e5022",
        borderRadius: 12,
        color: "#2c3e50",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.5px",
        padding: "2px 8px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function ToolCard({ tool, categories, reviews, onSelect }) {
  const avg = toolAvgRating(tool.id, reviews);
  const cat = categories.find((c) => c.id === tool.category);
  const reviewCount = reviews.filter((r) => r.toolId === tool.id && r.status === "approved").length;

  return (
    <button
      onClick={() => onSelect(tool)}
      style={{
        background: "#fff",
        border: "1.5px solid #e8e8e8",
        borderRadius: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        cursor: "pointer",
        overflow: "hidden",
        padding: 0,
        textAlign: "left",
      }}
    >
      <div style={productCardImageFrameStyle}>
        <img
          src={tool.img || "/images/products/product-placeholder.svg"}
          alt={tool.name}
          onError={(event) => {
            event.currentTarget.src = "/images/products/product-placeholder.svg";
          }}
          style={productCardImageStyle}
        />
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ marginBottom: 6 }}><Badge>{cat?.label}</Badge></div>
        <div style={{ color: "#1f2937", fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{tool.name}</div>
        <div style={{ color: "#777", fontSize: 12, marginBottom: 10 }}>{tool.brand}</div>
        <div style={{ alignItems: "center", display: "flex", gap: 6, marginBottom: 12 }}>
          {avg ? (
            <>
              <Stars rating={avg} />
              <span style={{ color: "#8a94a6", fontSize: 12 }}>({reviewCount})</span>
            </>
          ) : (
            <span style={{ color: "#a0a8b5", fontSize: 12 }}>No reviews yet</span>
          )}
        </div>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr", fontSize: 13 }}>
          <PriceBox label="/ hour" value={tool.hourly} color="#5c6bc0" bg="#f0f4ff" />
          <PriceBox label="/ day" value={tool.daily} color="#2e7d32" bg="#f0fff4" />
          <PriceBox label="/ week" value={tool.weekly} color="#e65100" bg="#fff8f0" />
        </div>
      </div>
    </button>
  );
}

function PriceBox({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
      <div style={{ color, fontWeight: 500 }}>LKR {value}</div>
      <div style={{ color: "#8a94a6", fontSize: 11 }}>{label}</div>
    </div>
  );
}

function ReviewCard({ review, tools, isAdmin, onApprove, onReject, onComment, onUpdateReview }) {
  const tool = tools.find((t) => t.id === review.toolId);
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ author: review.author, body: review.body, status: review.status, ratings: review.ratings });
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [threadText, setThreadText] = useState("");
  const avg = avgRating(review);
  const comments = review.comments || [];
  const rootComments = comments.filter((comment) => !comment.parentId);

  async function submitReply() {
    if (!replyText.trim()) return;
    await onComment(review.id, { author: "Shelton Tool-Hire", text: replyText.trim(), isCompany: true });
    setReplyText("");
    setShowReply(false);
  }

  async function submitPublicComment() {
    if (!commentAuthor.trim() || !commentText.trim()) return;
    await onComment(review.id, { author: commentAuthor.trim(), text: commentText.trim(), isCompany: false });
    setCommentAuthor("");
    setCommentText("");
  }

  async function submitThreadReply(parentId) {
    if (!commentAuthor.trim() || !threadText.trim()) return;
    await onComment(review.id, { author: commentAuthor.trim(), text: threadText.trim(), parentId, isCompany: false });
    setThreadText("");
    setReplyTo(null);
  }

  function startEdit() {
    setEditForm({ author: review.author, body: review.body, status: review.status, ratings: { ...review.ratings } });
    setIsEditing(true);
  }

  async function saveEdit() {
    if (!editForm.author.trim() || !editForm.body.trim()) return;
    await onUpdateReview(review.id, {
      author: editForm.author.trim(),
      body: editForm.body.trim(),
      status: editForm.status,
      ratings: editForm.ratings,
    });
    setIsEditing(false);
  }

  return (
    <div style={{ background: "#fff", border: "1.5px solid #e8e8e8", borderRadius: 12, marginBottom: 14, padding: "18px 20px" }}>
      <div style={{ alignItems: "flex-start", display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 500 }}>{review.author}</span>
          {tool && <span style={{ color: "#8a94a6", fontSize: 12, marginLeft: 10 }}>re: {tool.name}</span>}
          <div style={{ color: "#a0a8b5", fontSize: 12, marginTop: 2 }}>{review.date}</div>
        </div>
        <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
          <Stars rating={avg} />
          <span style={{ color: "#e67e22", fontSize: 13, fontWeight: 500 }}>{avg.toFixed(1)}</span>
          {isAdmin && (
            <span style={{ background: review.status === "approved" ? "#e8f5e9" : "#fff8e1", borderRadius: 10, color: review.status === "approved" ? "#2e7d32" : "#f57f17", fontSize: 11, padding: "2px 8px" }}>
              {review.status}
            </span>
          )}
        </div>
      </div>
      {isAdmin && isEditing ? (
        <div style={{ background: "#f8fafc", border: "1px solid #dfe4ec", borderRadius: 10, display: "grid", gap: 12, marginBottom: 14, padding: 14 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 180px" }}>
            <label style={labelStyle}>Author<input value={editForm.author} onChange={(e) => setEditForm({ ...editForm, author: e.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Status<select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={inputStyle}><option value="pending">Pending</option><option value="approved">Approved</option></select></label>
          </div>
          <label style={labelStyle}>Review text<textarea value={editForm.body} onChange={(e) => setEditForm({ ...editForm, body: e.target.value })} rows={3} style={inputStyle} /></label>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            {REVIEW_FEATURES.map((feature) => (
              <div key={feature.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10 }}>
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>{feature.label}</div>
                <Stars rating={editForm.ratings[feature.id]} size={18} interactive onRate={(value) => setEditForm({ ...editForm, ratings: { ...editForm.ratings, [feature.id]: value } })} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setIsEditing(false)} style={buttonStyle("#eef2f7", "#667085")}>Cancel</button>
            <button onClick={saveEdit} style={buttonStyle("#3f6fa6", "#fff")}>Save Review</button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ color: "#333", fontSize: 14, lineHeight: 1.6, margin: "0 0 14px" }}>{review.body}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {REVIEW_FEATURES.map((f) => (
              <div key={f.id} style={{ background: "#f5f5f5", borderRadius: 6, fontSize: 12, padding: "4px 10px" }}>
                <span style={{ color: "#8a94a6" }}>{f.label}: </span>
                <Stars rating={review.ratings[f.id]} size={12} />
              </div>
            ))}
          </div>
        </>
      )}
      {rootComments.map((c, i) => {
        const commentId = c.id || `legacy-${i}`;
        const replies = comments.filter((item) => item.parentId && Number(item.parentId) === Number(c.id));
        return (
          <div key={commentId} style={{ marginBottom: 8 }}>
            <div style={{ background: c.isCompany ? "#eaf2ff" : "#fafafa", borderLeft: `3px solid ${c.isCompany ? "#3f6fa6" : "#d0d7e2"}`, borderRadius: "0 8px 8px 0", fontSize: 13, padding: "9px 12px" }}>
              <strong style={{ color: c.isCompany ? "#3f6fa6" : "#334155" }}>{c.author}</strong>
              <span style={{ color: "#667085", marginLeft: 8 }}>{c.text}</span>
              {!isAdmin && c.id && <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} style={{ ...buttonStyle("transparent", "#3f6fa6"), marginLeft: 8, padding: "2px 6px" }}>Reply</button>}
            </div>
            {replies.map((reply) => (
              <div key={reply.id} style={{ background: "#fff", borderLeft: "3px solid #dfe4ec", borderRadius: "0 8px 8px 0", fontSize: 13, margin: "6px 0 0 24px", padding: "8px 12px" }}>
                <strong style={{ color: reply.isCompany ? "#3f6fa6" : "#334155" }}>{reply.author}</strong>
                <span style={{ color: "#667085", marginLeft: 8 }}>{reply.text}</span>
              </div>
            ))}
            {replyTo === c.id && (
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: "160px 1fr auto", margin: "8px 0 0 24px" }}>
                <input placeholder="Your name" value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} style={{ ...inputStyle, margin: 0 }} />
                <input placeholder="Reply to this thread..." value={threadText} onChange={(e) => setThreadText(e.target.value)} style={{ ...inputStyle, margin: 0 }} />
                <button onClick={() => submitThreadReply(c.id)} style={buttonStyle("#3f6fa6", "#fff")}>Post</button>
              </div>
            )}
          </div>
        );
      })}
      {!isAdmin && (
        <div style={{ borderTop: "1px solid #eef2f7", display: "grid", gap: 8, gridTemplateColumns: "160px 1fr auto", marginTop: 12, paddingTop: 12 }}>
          <input placeholder="Your name" value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} style={{ ...inputStyle, margin: 0 }} />
          <input placeholder="Comment on this review..." value={commentText} onChange={(e) => setCommentText(e.target.value)} style={{ ...inputStyle, margin: 0 }} />
          <button onClick={submitPublicComment} style={buttonStyle("#eef2f7", "#3f6fa6")}>Comment</button>
        </div>
      )}
      {isAdmin && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {review.status === "pending" ? (
            <button onClick={() => onApprove(review.id)} style={buttonStyle("#e8f5e9", "#2e7d32")}>Approve</button>
          ) : (
            <button onClick={() => onUpdateReview(review.id, { status: "pending" })} style={buttonStyle("#fff8e1", "#a16207")}>Mark Pending</button>
          )}
          <button onClick={startEdit} style={buttonStyle("#eef2ff", "#3f6fa6")}>Edit</button>
          <button onClick={() => setShowReply(!showReply)} style={buttonStyle("#e3f2fd", "#1565c0")}>Company reply</button>
          <button onClick={() => onReject(review.id)} style={buttonStyle("#ffebee", "#c62828")}>Delete</button>
        </div>
      )}
      {isAdmin && showReply && (
        <div style={{ marginTop: 10 }}>
          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder="Type company response..." style={inputStyle} />
          <button onClick={submitReply} style={{ ...buttonStyle("#1565c0", "#fff"), marginTop: 6 }}>Post Reply</button>
        </div>
      )}
    </div>
  );
}

function ToolDetail({ tool, categories, reviews, onBack, onSubmitReview, onComment }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [newReview, setNewReview] = useState({
    author: "",
    body: "",
    ratings: { performance: 5, service: 5, support: 5, aftersales: 5, misc: 5 },
  });
  const cat = categories.find((c) => c.id === tool.category);
  const toolReviews = reviews.filter((r) => r.toolId === tool.id && r.status === "approved");
  const avg = toolAvgRating(tool.id, reviews);
  const cost = calcCost(tool, start, end);

  async function handleSubmit() {
    if (!newReview.author.trim() || !newReview.body.trim()) return;
    await onSubmitReview({ ...newReview, toolId: tool.id });
    setSubmitted(true);
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#5c6bc0", cursor: "pointer", fontSize: 14, fontWeight: 500, marginBottom: 20, padding: 0 }}>Back to catalogue</button>
      <div style={{ display: "grid", gap: 32, gridTemplateColumns: "minmax(260px, 1fr) minmax(300px, 1fr)", marginBottom: 36 }}>
        <div>
          <div style={productDetailImageFrameStyle}>
            <img
              src={tool.img || "/images/products/product-placeholder.svg"}
              alt={tool.name}
              onError={(event) => {
                event.currentTarget.src = "/images/products/product-placeholder.svg";
              }}
              style={productDetailImageStyle}
            />
          </div>
          <div style={{ background: "#fff", border: "1.5px solid #e8e8e8", borderRadius: 12, padding: 16 }}>
            <div style={{ color: "#1f2937", fontWeight: 500, marginBottom: 10 }}>Specifications</div>
            {(tool.specs || []).map((s, i) => (
              <div key={i} style={{ borderBottom: i < tool.specs.length - 1 ? "1px solid #f0f0f0" : "none", color: "#555", fontSize: 13, padding: "4px 0" }}>{s}</div>
            ))}
          </div>
        </div>
        <div>
          <Badge>{cat?.label}</Badge>
          <h2 style={{ color: "#1f2937", fontSize: 26, fontWeight: 500, margin: "10px 0 4px" }}>{tool.name}</h2>
          <div style={{ color: "#8a94a6", fontSize: 14, marginBottom: 12 }}>by {tool.brand}</div>
          {avg ? (
            <div style={{ alignItems: "center", display: "flex", gap: 8, marginBottom: 16 }}>
              <Stars rating={avg} size={20} />
              <span style={{ color: "#e67e22", fontSize: 18, fontWeight: 500 }}>{avg.toFixed(1)}</span>
              <span style={{ color: "#8a94a6", fontSize: 13 }}>({toolReviews.length} reviews)</span>
            </div>
          ) : (
            <div style={{ color: "#a0a8b5", fontSize: 13, marginBottom: 16 }}>No reviews yet. Be the first.</div>
          )}
          <p style={{ color: "#444", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>{tool.desc}</p>
          <div style={{ background: "#f8f9ff", border: "1.5px solid #e0e5ff", borderRadius: 12, marginBottom: 20, padding: 18 }}>
            <div style={{ color: "#1f2937", fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Estimate Hire Cost</div>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
              <label style={{ color: "#8a94a6", fontSize: 12 }}>Start date & time<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} /></label>
              <label style={{ color: "#8a94a6", fontSize: 12 }}>End date & time<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} /></label>
            </div>
            {cost ? (
              <div style={{ background: "#fff", border: "1.5px solid #ffe0b2", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                <div style={{ color: "#8a94a6", fontSize: 12, marginBottom: 4 }}>{cost.label}</div>
                <div style={{ color: "#e65100", fontSize: 32, fontWeight: 500 }}>LKR {cost.amount.toFixed(2)}</div>
                <div style={{ color: "#a0a8b5", fontSize: 11, marginTop: 4 }}>Estimated hire cost excluding VAT</div>
              </div>
            ) : start && end ? (
              <div style={{ color: "#c0392b", fontSize: 13, padding: 8 }}>Please check your dates. End must be after start.</div>
            ) : null}
          </div>
        </div>
      </div>

      <section style={{ borderTop: "2px solid #f0f0f0", paddingTop: 28 }}>
        <h3 style={{ color: "#1f2937", fontWeight: 500, marginBottom: 20 }}>Customer Reviews</h3>
        {toolReviews.length === 0 && <div style={{ color: "#a0a8b5", marginBottom: 24 }}>No approved reviews yet for this item.</div>}
        {toolReviews.map((r) => <ReviewCard key={r.id} review={r} tools={[tool]} isAdmin={false} onComment={onComment} />)}
      </section>

      <section style={{ background: "#f8f9ff", border: "1.5px solid #e0e5ff", borderRadius: 14, marginTop: 24, padding: 24 }}>
        <h4 style={{ color: "#1f2937", fontWeight: 500, marginBottom: 16 }}>Leave a Review</h4>
        {submitted ? (
          <div style={{ background: "#e8f5e9", borderRadius: 10, color: "#2e7d32", fontWeight: 500, padding: "16px 20px" }}>Thank you. Your review is pending approval.</div>
        ) : (
          <>
            <input placeholder="Your name" value={newReview.author} onChange={(e) => setNewReview({ ...newReview, author: e.target.value })} style={inputStyle} />
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", margin: "14px 0" }}>
              {REVIEW_FEATURES.map((f) => (
                <div key={f.id} style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ color: "#8a94a6", fontSize: 12, marginBottom: 4 }}>{f.label}</div>
                  <Stars rating={newReview.ratings[f.id]} size={22} interactive onRate={(v) => setNewReview({ ...newReview, ratings: { ...newReview.ratings, [f.id]: v } })} />
                </div>
              ))}
            </div>
            <textarea placeholder="Share your experience with this equipment..." value={newReview.body} onChange={(e) => setNewReview({ ...newReview, body: e.target.value })} rows={4} style={inputStyle} />
            <button onClick={handleSubmit} style={{ ...buttonStyle("#5c6bc0", "#fff"), marginTop: 14, padding: "10px 28px" }}>Submit Review</button>
          </>
        )}
      </section>
    </div>
  );
}

function CustomerPortal({ categories, tools, reviews, catFilter, onCategoryChange, onSubmitReview, onComment }) {
  const [selectedTool, setSelectedTool] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const approvedCount = reviews.filter((review) => review.status === "approved").length;
  const topRatedCount = tools.filter((tool) => (toolAvgRating(tool.id, reviews) || 0) >= 4.5).length;

  const filtered = useMemo(() => {
    let result = tools;
    if (catFilter !== "all") result = result.filter((tool) => tool.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((tool) => [tool.name, tool.brand, tool.desc].some((value) => value.toLowerCase().includes(q)));
    }
    if (sortBy === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "price_asc") result = [...result].sort((a, b) => a.daily - b.daily);
    if (sortBy === "rating") result = [...result].sort((a, b) => (toolAvgRating(b.id, reviews) || 0) - (toolAvgRating(a.id, reviews) || 0));
    return result;
  }, [tools, catFilter, search, sortBy, reviews]);

  if (selectedTool) {
    const currentTool = tools.find((tool) => tool.id === selectedTool.id) || selectedTool;
    return <ToolDetail tool={currentTool} categories={categories} reviews={reviews} onBack={() => setSelectedTool(null)} onSubmitReview={onSubmitReview} onComment={onComment} />;
  }

  return (
    <div>
      <div style={summaryGridStyle}>
        <SummaryTile value={filtered.length} label="Shown" hint="Current result set" color="#3f6fa6" />
        <SummaryTile value={tools.length} label="Total equipment" hint="Available catalogue" color="#f59e0b" />
        <SummaryTile value={approvedCount} label="Reviews" hint="Approved feedback" color="#0aa37f" />
        <SummaryTile value={topRatedCount} label="Top rated" hint="4.5 stars and above" color="#3f6fa6" />
      </div>

      <div style={toolbarStyle}>
        <input placeholder="Search by tool, brand, or description..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, margin: 0, maxWidth: 360 }} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, margin: 0, maxWidth: 190 }}>
          <option value="name">Sort: A-Z</option>
          <option value="price_asc">Sort: Price up</option>
          <option value="rating">Sort: Rating</option>
        </select>
        {catFilter !== "all" && (
          <button onClick={() => onCategoryChange("all")} style={buttonStyle("#edf4ff", "#3f6fa6")}>Clear category</button>
        )}
      </div>
      <div style={{ color: "#8a94a6", fontSize: 13, marginBottom: 16 }}>{filtered.length} item{filtered.length !== 1 ? "s" : ""} found</div>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {filtered.map((tool) => <ToolCard key={tool.id} tool={tool} categories={categories} reviews={reviews} onSelect={setSelectedTool} />)}
        {filtered.length === 0 && <div style={{ color: "#a0a8b5", fontSize: 15, gridColumn: "1/-1", padding: "60px 0", textAlign: "center" }}>No equipment found for your search.</div>}
      </div>
    </div>
  );
}

function AdminPanel({ categories, tools, reviews, onApprove, onReject, onUpdateReview, onComment, onAddTool, onUpdatePrice, onAddCategory, onUpdateCategory }) {
  const [tab, setTab] = useState("reviews");
  const [editTool, setEditTool] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [addForm, setAddForm] = useState({ name: "", brand: "", category: "building", hourly: "", daily: "", weekly: "", img: "", desc: "" });
  const [categoryForm, setCategoryForm] = useState({ label: "", icon: "", img: "" });
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [editCategoryForm, setEditCategoryForm] = useState(null);
  const pending = reviews.filter((r) => r.status === "pending");
  const approved = reviews.filter((r) => r.status === "approved");

  async function addTool() {
    if (!addForm.name.trim()) return;
    await onAddTool({
      ...addForm,
      hourly: parseFloat(addForm.hourly) || 0,
      daily: parseFloat(addForm.daily) || 0,
      weekly: parseFloat(addForm.weekly) || 0,
      img: addForm.img.trim() || "/images/products/product-placeholder.svg",
      specs: [],
    });
    setAddForm({ name: "", brand: "", category: "building", hourly: "", daily: "", weekly: "", img: "", desc: "" });
  }

  async function addCategory() {
    if (!categoryForm.label.trim()) return;
    const saved = await onAddCategory(categoryForm);
    setAddForm((current) => ({ ...current, category: saved.id }));
    setCategoryForm({ label: "", icon: "", img: "" });
  }

  function openEditCategory(category) {
    if (editCategoryId === category.id) {
      setEditCategoryId(null);
      setEditCategoryForm(null);
      return;
    }

    setEditCategoryId(category.id);
    setEditCategoryForm({
      label: category.label || "",
      icon: category.icon || "",
      img: category.img || "",
    });
  }

  async function saveEditedCategory(categoryId) {
    if (!editCategoryForm?.label.trim()) return;
    await onUpdateCategory(categoryId, {
      label: editCategoryForm.label.trim(),
      icon: editCategoryForm.icon.trim(),
      img: editCategoryForm.img.trim() || "/images/categories/category-placeholder.svg",
    });
    setEditCategoryId(null);
    setEditCategoryForm(null);
  }

  function openEditTool(tool) {
    if (editTool === tool.id) {
      setEditTool(null);
      setEditForm(null);
      return;
    }

    setEditTool(tool.id);
    setEditForm({
      name: tool.name || "",
      brand: tool.brand || "",
      category: tool.category || "building",
      hourly: String(tool.hourly ?? ""),
      daily: String(tool.daily ?? ""),
      weekly: String(tool.weekly ?? ""),
      img: tool.img || "",
      desc: tool.desc || "",
      specs: (tool.specs || []).join("\n"),
    });
  }

  async function saveEditedTool(toolId) {
    if (!editForm?.name.trim()) return;
    await onUpdatePrice(toolId, {
      name: editForm.name.trim(),
      brand: editForm.brand.trim(),
      category: editForm.category,
      hourly: parseFloat(editForm.hourly) || 0,
      daily: parseFloat(editForm.daily) || 0,
      weekly: parseFloat(editForm.weekly) || 0,
      img: editForm.img.trim() || "/images/products/product-placeholder.svg",
      desc: editForm.desc.trim(),
      specs: editForm.specs.split("\n").map((item) => item.trim()).filter(Boolean),
    });
    setEditTool(null);
    setEditForm(null);
  }

  return (
    <div>
      <div style={{ alignItems: "center", background: "#1f2937", borderRadius: 14, color: "#fff", display: "flex", gap: 16, marginBottom: 24, padding: "20px 28px" }}>
        <span style={{ fontSize: "clamp(24px, 2.4vw, 28px)" }}>Admin</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Admin Back-end</div>
          <div style={{ color: "#90caf9", fontSize: 12 }}>Shelton Tool-Hire Management Portal</div>
        </div>
        <div style={{ display: "flex", gap: 16, marginLeft: "auto", textAlign: "center" }}>
          <Stat label="Pending" value={pending.length} color="#ffd54f" />
          <Stat label="Live" value={approved.length} color="#81c784" />
          <Stat label="Tools" value={tools.length} color="#64b5f6" />
        </div>
      </div>
      <div style={{ background: "#f5f5f5", borderRadius: 10, display: "flex", gap: 6, marginBottom: 24, padding: 4 }}>
        {[
          ["reviews", `Review Moderation (${pending.length})`],
          ["equipment", "Equipment Manager"],
          ["categories", "Categories"],
          ["add", "Add New Equipment"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...buttonStyle(tab === id ? "#fff" : "transparent", tab === id ? "#1f2937" : "#8a94a6"), boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.1)" : "none", flex: 1 }}>{label}</button>
        ))}
      </div>

      {tab === "reviews" && (
        <div>
          {pending.length > 0 && (
            <>
              <div style={{ color: "#c62828", fontWeight: 500, marginBottom: 12 }}>Awaiting Moderation ({pending.length})</div>
              {pending.map((r) => <ReviewCard key={r.id} review={r} tools={tools} isAdmin onApprove={onApprove} onReject={onReject} onUpdateReview={onUpdateReview} onComment={onComment} />)}
              <div style={{ borderTop: "2px solid #f0f0f0", marginBottom: 20 }} />
            </>
          )}
          <div style={{ color: "#2e7d32", fontWeight: 500, marginBottom: 12 }}>Approved Reviews ({approved.length})</div>
          {approved.map((r) => <ReviewCard key={r.id} review={r} tools={tools} isAdmin onApprove={onApprove} onReject={onReject} onUpdateReview={onUpdateReview} onComment={onComment} />)}
        </div>
      )}

      {tab === "categories" && (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ background: "#fff", border: "1px solid #dfe4ec", borderRadius: 12, padding: 20 }}>
            <h4 style={{ color: "#1f2937", fontWeight: 500, margin: "0 0 14px" }}>Add Category</h4>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 140px 1fr auto", alignItems: "end" }}>
              <label style={labelStyle}>Category name<input value={categoryForm.label} onChange={(e) => setCategoryForm({ ...categoryForm, label: e.target.value })} style={inputStyle} /></label>
              <label style={labelStyle}>Short icon/text<input value={categoryForm.icon} onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })} placeholder="e.g. Lift" style={inputStyle} /></label>
              <label style={labelStyle}>Small image path<input value={categoryForm.img} onChange={(e) => setCategoryForm({ ...categoryForm, img: e.target.value })} placeholder="/images/categories/lifting.jpg" style={inputStyle} /></label>
              <button onClick={addCategory} style={buttonStyle("#3f6fa6", "#fff")}>Add</button>
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #dfe4ec", borderRadius: 12, overflow: "hidden" }}>
            {categories.map((category) => (
              <div key={category.id} style={{ borderBottom: "1px solid #eef2f7", padding: "12px 16px" }}>
                <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
                  <img
                    src={category.img || "/images/categories/category-placeholder.svg"}
                    alt={category.label}
                    onError={(event) => {
                      event.currentTarget.src = "/images/categories/category-placeholder.svg";
                    }}
                    style={{ borderRadius: 8, height: 40, objectFit: "cover", width: 40 }}
                  />
                  <span style={{ background: "#eaf2ff", borderRadius: 8, color: "#3f6fa6", fontSize: 12, fontWeight: 500, padding: "4px 8px" }}>{category.icon}</span>
                  <span style={{ color: "#1f2937", fontWeight: 500 }}>{category.label}</span>
                  <span style={{ color: "#8a94a6", fontSize: 12, marginLeft: "auto" }}>{category.id}</span>
                  <button onClick={() => openEditCategory(category)} style={buttonStyle("#e3f2fd", "#1565c0")}>{editCategoryId === category.id ? "Close" : "Edit"}</button>
                </div>
                {editCategoryId === category.id && editCategoryForm && (
                  <div style={{ borderTop: "1px solid #eef2f7", display: "grid", gap: 12, gridTemplateColumns: "1fr 140px 1fr auto auto", marginTop: 12, paddingTop: 12, alignItems: "end" }}>
                    <label style={labelStyle}>Category name<input value={editCategoryForm.label} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, label: e.target.value })} style={inputStyle} /></label>
                    <label style={labelStyle}>Icon/text<input value={editCategoryForm.icon} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, icon: e.target.value })} style={inputStyle} /></label>
                    <label style={labelStyle}>Small image path<input value={editCategoryForm.img} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, img: e.target.value })} placeholder="/images/categories/lifting.jpg" style={inputStyle} /></label>
                    <button onClick={() => { setEditCategoryId(null); setEditCategoryForm(null); }} style={buttonStyle("#eef2f7", "#667085")}>Cancel</button>
                    <button onClick={() => saveEditedCategory(category.id)} style={buttonStyle("#2e7d32", "#fff")}>Save</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "equipment" && (
        <div>
          {tools.map((tool) => (
            <div key={tool.id} style={{ background: "#fff", border: "1.5px solid #e8e8e8", borderRadius: 12, marginBottom: 14, padding: "16px 20px" }}>
              <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
                <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
                  <img
                    src={tool.img || "/images/products/product-placeholder.svg"}
                    alt={tool.name}
                    onError={(event) => {
                      event.currentTarget.src = "/images/products/product-placeholder.svg";
                    }}
                    style={{ borderRadius: 8, height: 48, objectFit: "cover", width: 64 }}
                  />
                  <div>
                  <div style={{ color: "#1f2937", fontWeight: 500 }}>{tool.name}</div>
                  <div style={{ color: "#8a94a6", fontSize: 12 }}>{tool.brand} - {categories.find((c) => c.id === tool.category)?.label}</div>
                  </div>
                </div>
                <button onClick={() => openEditTool(tool)} style={buttonStyle("#e3f2fd", "#1565c0")}>{editTool === tool.id ? "Close" : "Edit Equipment"}</button>
              </div>
              {editTool === tool.id && editForm && (
                <div style={{ borderTop: "1px solid #eef2f7", display: "grid", gap: 14, marginTop: 16, paddingTop: 16 }}>
                  <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                    <label style={labelStyle}>Equipment name *<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} /></label>
                    <label style={labelStyle}>Brand<input value={editForm.brand} onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })} style={inputStyle} /></label>
                    <label style={labelStyle}>Category<select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} style={inputStyle}>{categories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></label>
                    <label style={labelStyle}>Image path<input value={editForm.img} onChange={(e) => setEditForm({ ...editForm, img: e.target.value })} placeholder="/images/products/my-tool.jpg" style={inputStyle} /></label>
                  </div>
                  <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr 1fr" }}>
                    {["hourly", "daily", "weekly"].map((field) => (
                      <label key={field} style={{ ...labelStyle, textTransform: "capitalize" }}>
                        {field} LKR
                        <input type="number" step="0.5" value={editForm[field]} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} style={inputStyle} />
                      </label>
                    ))}
                  </div>
                  <label style={labelStyle}>Description<textarea value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} rows={3} style={inputStyle} /></label>
                  <label style={labelStyle}>Specifications, one per line<textarea value={editForm.specs} onChange={(e) => setEditForm({ ...editForm, specs: e.target.value })} rows={5} style={inputStyle} /></label>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => { setEditTool(null); setEditForm(null); }} style={buttonStyle("#eef2f7", "#667085")}>Cancel</button>
                    <button onClick={() => saveEditedTool(tool.id)} style={buttonStyle("#2e7d32", "#fff")}>Save Changes</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "add" && (
        <div style={{ background: "#fff", border: "1.5px solid #e8e8e8", borderRadius: 14, padding: 24 }}>
          <h4 style={{ color: "#1f2937", fontWeight: 500, marginBottom: 20 }}>Add New Equipment</h4>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
            <label style={labelStyle}>Equipment Name *<input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Brand<input value={addForm.brand} onChange={(e) => setAddForm({ ...addForm, brand: e.target.value })} style={inputStyle} /></label>
            <label style={labelStyle}>Category<select value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} style={inputStyle}>{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label style={labelStyle}>Image path<input value={addForm.img} onChange={(e) => setAddForm({ ...addForm, img: e.target.value })} placeholder="/images/products/my-tool.jpg" style={inputStyle} /></label>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
              {["hourly", "daily", "weekly"].map((field) => <label key={field} style={labelStyle}>{field} LKR<input type="number" value={addForm[field]} onChange={(e) => setAddForm({ ...addForm, [field]: e.target.value })} style={inputStyle} /></label>)}
            </div>
          </div>
          <label style={labelStyle}>Description<textarea value={addForm.desc} onChange={(e) => setAddForm({ ...addForm, desc: e.target.value })} rows={3} style={inputStyle} /></label>
          <button onClick={addTool} style={{ ...buttonStyle("#5c6bc0", "#fff"), marginTop: 16, padding: "12px 28px" }}>Add Equipment</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ color, fontSize: 22, fontWeight: 500 }}>{value}</div>
      <div style={{ color: "#90caf9", fontSize: 11 }}>{label}</div>
    </div>
  );
}

function SummaryTile({ value, label, hint, color }) {
  return (
    <div style={summaryTileStyle}>
      <div style={{ color, fontSize: 30, fontWeight: 500, lineHeight: 1 }}>{value}</div>
      <div style={{ color: "#1f2937", fontSize: 13, fontWeight: 500, marginTop: 6 }}>{label}</div>
      <div style={{ color: "#8a94a6", fontSize: 12, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

const inputStyle = {
  border: "1px solid #ddd",
  borderRadius: 8,
  boxSizing: "border-box",
  display: "block",
  fontSize: 14,
  marginTop: 4,
  padding: "10px 12px",
  resize: "vertical",
  width: "100%",
};

const labelStyle = { color: "#8a94a6", fontSize: 12 };

const productCardImageStyle = {
  display: "block",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
  width: "100%",
};

const productCardImageFrameStyle = {
  aspectRatio: "10 / 7",
  background: "#f5f7fa",
  height: 182,
  overflow: "hidden",
  width: "100%",
};

const productDetailImageStyle = {
  display: "block",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center",
  width: "100%",
};

const productDetailImageFrameStyle = {
  background: "#f0f4ff",
  border: "1px solid #dfe4ec",
  borderRadius: 16,
  height: 360,
  marginBottom: 16,
  maxWidth: 520,
  overflow: "hidden",
  width: "100%",
};

function buttonStyle(background, color) {
  return {
    background,
    border: "none",
    borderRadius: 8,
    color,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    padding: "8px 16px",
  };
}

function AppShell({ route, setRoute, categories, selectedCategory, onCategoryChange, toolsCount, pendingCount, approvedCount, status, error, onLogout, children }) {
  const isAdmin = route.startsWith("admin");
  const title = isAdmin ? "Admin dashboard" : "Equipment catalogue";
  const subtitle = isAdmin ? `${pendingCount} pending reviews - ${toolsCount} tools managed` : `${toolsCount} tools available - ${approvedCount} approved reviews`;

  return (
    <div className="app-shell" style={{ fontFamily: "var(--sans)", minHeight: "100svh" }}>
      <TopBar isAdmin={isAdmin} onLogout={onLogout} />
      <div style={{ display: "flex", minHeight: "calc(100svh - 52px)" }}>
        <SidePanel route={route} setRoute={setRoute} categories={categories} selectedCategory={selectedCategory} onCategoryChange={onCategoryChange} pendingCount={pendingCount} />
        <main className="app-main" style={mainStyle}>
          <header className="app-page-header" style={pageHeaderStyle}>
            <div>
              <div style={{ color: "#8a94a6", fontSize: 12, marginBottom: 2 }}>{isAdmin ? "Management" : "Catalogue"}</div>
              <h1 style={{ color: "#1f2937", fontSize: "clamp(24px, 2.4vw, 28px)", fontWeight: 500, margin: "0 0 4px" }}>{title}</h1>
              <p style={{ color: "#667085", fontSize: 14 }}>{subtitle}</p>
            </div>
            <div style={connectionPillStyle}>
              <span style={{ background: status === "ready" ? "#0aa37f" : status === "error" ? "#ef4444" : "#f59e0b", borderRadius: 999, height: 8, width: 8 }} />
              <span style={{ color: "#667085", fontSize: 13, fontWeight: 500 }}>{status === "ready" ? "Database connected" : status === "error" ? "API offline" : "Loading"}</span>
            </div>
          </header>

          {status === "loading" && <div style={emptyStateStyle}>Loading database...</div>}
          {status === "error" && (
            <div style={{ background: "#fff0f0", border: "1px solid #ffc9c9", borderRadius: 14, color: "#b42318", padding: 20 }}>
              Could not connect to the API. Start it with <code>npm run api</code>. Details: {error}
            </div>
          )}
          {status === "ready" && children}
        </main>
      </div>
    </div>
  );
}

function TopBar({ isAdmin, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header style={topBarStyle}>
      <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
        <div style={topLogoStyle}>ST</div>
        <div>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 500, lineHeight: 1 }}>Shelton Tool-Hire</div>
          <div style={{ color: "#b9cff5", fontSize: 11, marginTop: 3 }}>Equipment Hire System</div>
        </div>
      </div>
      <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => setProfileOpen((open) => !open)} style={profileButtonStyle} title="Profile menu">
            <span style={avatarStyle}><Icon name="user" size={18} /></span>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{isAdmin ? "Admin" : "Guest"}</span>
            <Icon name="chevron" size={14} color="#dbe8ff" />
          </button>
          {profileOpen && (
            <div style={profileMenuStyle}>
              <div style={{ borderBottom: "1px solid #eef2f7", padding: "12px 14px" }}>
                <div style={{ color: "#1f2937", fontSize: 14, fontWeight: 500 }}>{isAdmin ? "Admin User" : "Customer User"}</div>
                <div style={{ color: "#8a94a6", fontSize: 12, marginTop: 2 }}>{isAdmin ? "admin@shelton.local" : "guest@shelton.local"}</div>
              </div>
              <ProfileMenuItem icon="settings" label="Profile settings" />
              <ProfileMenuItem icon="bell" label="Notifications" />
              <ProfileMenuItem icon="lock" label="Security" />
              <div style={{ borderTop: "1px solid #eef2f7", marginTop: 6, paddingTop: 6 }}>
                <ProfileMenuItem icon="logout" label="Sign out" danger onClick={onLogout} />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SidePanel({ route, setRoute, categories, selectedCategory, onCategoryChange, pendingCount }) {
  const isAdmin = route.startsWith("admin");

  return (
    <aside className="app-sidebar" style={sidebarStyle}>
      <nav style={{ display: "grid", gap: 4, marginTop: 10 }}>
        <SideNavItem active={route === "customer"} label="Catalogue" icon="catalogue" onClick={() => setRoute("customer")} />
        {isAdmin && <SideNavItem active label="Admin" icon="admin" badge={pendingCount} onClick={() => setRoute("admin")} />}
      </nav>

      {!isAdmin && (
        <>
          <div style={sideSectionLabelStyle}>Categories</div>
          <div style={{ display: "grid", gap: 2 }}>
            <SideNavItem active={selectedCategory === "all"} label="All categories" icon="grid" onClick={() => onCategoryChange("all")} />
            {categories.map((category) => (
              <SideNavItem key={category.id} active={selectedCategory === category.id} label={category.label} img={category.img} onClick={() => onCategoryChange(category.id)} />
            ))}
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <div style={sideSectionLabelStyle}>Admin sections</div>
          <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.6, padding: "0 18px" }}>Use the tabs in the dashboard to moderate reviews, update equipment prices, and add tools.</div>
        </>
      )}
    </aside>
  );
}

function SideNavItem({ active, label, icon, img, badge, onClick }) {
  return (
    <button onClick={onClick} style={{ ...sideNavItemStyle, background: active ? "#eaf2ff" : "transparent", borderLeftColor: active ? "#f5c84b" : "transparent", color: active ? "#365f95" : "#667085", fontWeight: active ? 900 : 700 }}>
      {img ? (
        <img
          src={img}
          alt=""
          onError={(event) => {
            event.currentTarget.src = "/images/categories/category-placeholder.svg";
          }}
          style={{ borderRadius: 6, height: 24, objectFit: "cover", width: 24 }}
        />
      ) : (
        <span style={{ alignItems: "center", color: active ? "#365f95" : "#7b8797", display: "flex", width: 24 }}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {badge ? <span style={{ background: "#eef2f7", borderRadius: 999, color: "#667085", fontSize: 11, padding: "1px 7px" }}>{badge}</span> : null}
    </button>
  );
}

function ProfileMenuItem({ icon, label, danger = false, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ alignItems: "center", background: "transparent", border: "none", color: danger ? "#b42318" : "#667085", cursor: "pointer", display: "flex", gap: 10, padding: "9px 14px", textAlign: "left", width: "100%" }}>
      <Icon name={icon} size={16} color={danger ? "#b42318" : "#64748b"} />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

function Icon({ name, size = 18, color = "currentColor" }) {
  const common = { fill: "none", stroke: color, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2 };
  const paths = {
    catalogue: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h10M7 16h6" />
      </>
    ),
    admin: (
      <>
        <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
        <path d="M9.5 12l1.8 1.8 3.7-4" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.2-6 8-6s6.5 2 8 6" />
      </>
    ),
    chevron: <path d="M6 9l6 6 6-6" />,
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-2 .4l-.4.2a1.7 1.7 0 0 0-1 1.6V23h-4v-.5a1.7 1.7 0 0 0-1-1.6l-.4-.2a1.7 1.7 0 0 0-2-.4l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 5 15l-.2-.4A1.7 1.7 0 0 0 3.2 14H3v-4h.2a1.7 1.7 0 0 0 1.6-.9L5 8.7a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 2-.4l.4-.2a1.7 1.7 0 0 0 1-1.6V1h4v.2a1.7 1.7 0 0 0 1 1.6l.4.2a1.7 1.7 0 0 0 2 .4l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9l.2.4a1.7 1.7 0 0 0 1.6.9h.2v4h-.2a1.7 1.7 0 0 0-1.6.6l-.2.4z" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 4v16" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {paths[name] || paths.grid}
    </svg>
  );
}

function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const mockUser = {
    username: "admin@shelton.lk",
    password: "Shelton@123",
    name: "Admin User",
    role: "Operations Manager",
  };

  function submit(event) {
    event.preventDefault();
    if (username.trim().toLowerCase() !== mockUser.username || password !== mockUser.password) {
      setError("Invalid username or password.");
      return;
    }
    onLogin();
  }

  return (
    <div style={{ background: "linear-gradient(135deg, #eef4ff 0%, #f8fafc 55%, #ffffff 100%)", minHeight: "100svh" }}>
      <TopBar isAdmin={false} />
      <main className="admin-login-layout" style={{ alignItems: "center", display: "grid", gridTemplateColumns: "minmax(280px, 480px) minmax(320px, 420px)", justifyContent: "center", minHeight: "calc(100svh - 52px)", padding: 32, gap: 44 }}>
        <section>
          <div style={{ alignItems: "center", background: "#fff", border: "1px solid #dfe4ec", borderRadius: 18, boxShadow: "0 18px 50px rgba(35,74,145,0.10)", display: "inline-flex", gap: 10, marginBottom: 22, padding: "10px 14px" }}>
            <span style={{ ...avatarStyle, height: 36, width: 36 }}><Icon name="admin" size={19} /></span>
            <div>
              <div style={{ color: "#1f2937", fontSize: 14, fontWeight: 500 }}>Shelton Admin</div>
              <div style={{ color: "#8a94a6", fontSize: 12 }}>Secure management access</div>
            </div>
          </div>
          <h1 style={{ color: "#1f2937", fontSize: "clamp(30px, 4vw, 40px)", fontWeight: 500, letterSpacing: 0, lineHeight: 1.08, margin: "0 0 14px" }}>Manage equipment, reviews, and categories.</h1>
          <p style={{ color: "#667085", fontSize: 16, lineHeight: 1.7, maxWidth: 500 }}>Sign in with the mock admin account to update the hire catalogue, approve reviews, and maintain product information.</p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 28, maxWidth: 500 }}>
            <LoginMetric value="Tools" label="Catalogue" />
            <LoginMetric value="Reviews" label="Moderation" />
            <LoginMetric value="LKR" label="Pricing" />
          </div>
        </section>

        <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #dfe4ec", borderRadius: 18, boxShadow: "0 24px 70px rgba(15,23,42,0.12)", padding: 30, width: "100%" }}>
          <div style={{ color: "#3f6fa6", fontSize: 12, fontWeight: 500, marginBottom: 8, textTransform: "uppercase" }}>Admin login</div>
          <h2 style={{ color: "#1f2937", fontSize: 26, fontWeight: 500, margin: "0 0 8px" }}>Welcome back</h2>
          <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>Enter your mock admin credentials to continue.</p>

          <label style={labelStyle}>
            Username
            <input type="email" value={username} onChange={(event) => setUsername(event.target.value)} autoFocus placeholder="admin@shelton.lk" style={{ ...inputStyle, padding: "12px 14px" }} />
          </label>
          <label style={{ ...labelStyle, display: "block", marginTop: 14 }}>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" style={{ ...inputStyle, padding: "12px 14px" }} />
          </label>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            <label style={{ alignItems: "center", color: "#64748b", display: "flex", fontSize: 13, gap: 8 }}>
              <input type="checkbox" defaultChecked /> Remember me
            </label>
            <button type="button" style={{ background: "transparent", border: "none", color: "#3f6fa6", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: 0 }}>Forgot password?</button>
          </div>
          {error && <div style={{ background: "#fff0f0", border: "1px solid #ffc9c9", borderRadius: 10, color: "#b42318", fontSize: 13, marginTop: 14, padding: "10px 12px" }}>{error}</div>}
          <button type="submit" style={{ ...buttonStyle("#3f6fa6", "#fff"), fontSize: 14, marginTop: 20, padding: "12px 18px", width: "100%" }}>Sign in</button>
          <button type="button" onClick={() => { window.history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); }} style={{ ...buttonStyle("#eef2f7", "#667085"), marginTop: 10, padding: "12px 18px", width: "100%" }}>Back to catalogue</button>
        </form>
      </main>
    </div>
  );
}

function LoginMetric({ value, label }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.78)", border: "1px solid #dfe4ec", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ color: "#3f6fa6", fontSize: 18, fontWeight: 500 }}>{value}</div>
      <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{label}</div>
    </div>
  );
}

const sidebarStyle = {
  background: "#fff",
  borderRight: "1px solid #dfe4ec",
  boxSizing: "border-box",
  flexShrink: 0,
  minHeight: "calc(100svh - 52px)",
  padding: "10px 0 20px",
  width: 232,
};

const mainStyle = {
  background: "#f7f8fa",
  boxSizing: "border-box",
  flex: 1,
  minWidth: 0,
  padding: "20px 28px 56px",
};

const pageHeaderStyle = {
  alignItems: "center",
  display: "flex",
  gap: 20,
  justifyContent: "space-between",
  marginBottom: 26,
};

const topBarStyle = {
  alignItems: "center",
  background: "#3f6fa6",
  boxSizing: "border-box",
  display: "flex",
  height: 52,
  justifyContent: "space-between",
  padding: "0 24px 0 16px",
};

const topLogoStyle = {
  alignItems: "center",
  background: "#f5c84b",
  borderRadius: 8,
  color: "#365f95",
  display: "flex",
  fontSize: 13,
  fontWeight: 500,
  height: 32,
  justifyContent: "center",
  width: 32,
};

const avatarStyle = {
  alignItems: "center",
  background: "#f5c84b",
  borderRadius: 999,
  color: "#365f95",
  display: "flex",
  fontSize: 12,
  fontWeight: 500,
  height: 32,
  justifyContent: "center",
  width: 32,
};

const profileButtonStyle = {
  alignItems: "center",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "flex",
  gap: 8,
  padding: 0,
};

const profileMenuStyle = {
  background: "#fff",
  border: "1px solid #dfe4ec",
  borderRadius: 12,
  boxShadow: "0 18px 44px rgba(15,23,42,0.16)",
  minWidth: 220,
  overflow: "hidden",
  padding: "6px 0",
  position: "absolute",
  right: 0,
  top: 42,
  zIndex: 20,
};

const sideNavItemStyle = {
  alignItems: "center",
  border: "none",
  borderLeft: "3px solid transparent",
  cursor: "pointer",
  display: "flex",
  fontSize: 14,
  gap: 10,
  padding: "10px 18px",
  textAlign: "left",
  width: "100%",
};

const sideSectionLabelStyle = {
  color: "#8a94a6",
  fontSize: 12,
  fontWeight: 500,
  margin: "22px 18px 8px",
  textTransform: "uppercase",
};

const connectionPillStyle = {
  alignItems: "center",
  background: "#fff",
  border: "1px solid #dfe4ec",
  borderRadius: 12,
  display: "flex",
  gap: 10,
  minWidth: 180,
  padding: "9px 12px",
};

const summaryGridStyle = {
  background: "#fff",
  border: "1px solid #dfe4ec",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(140px, 1fr))",
  margin: "-20px -28px 0",
};

const summaryTileStyle = {
  borderRight: "1px solid #dfe4ec",
  minHeight: 82,
  padding: "18px 20px",
};

const toolbarStyle = {
  alignItems: "center",
  background: "#fff",
  borderBottom: "1px solid #dfe4ec",
  borderTop: "1px solid #dfe4ec",
  display: "flex",
  gap: 10,
  margin: "0 -28px 28px",
  padding: "14px 28px",
};

const emptyStateStyle = {
  background: "#fff",
  border: "1px solid #dfe4ec",
  borderRadius: 14,
  color: "#6b7280",
  padding: 40,
  textAlign: "center",
};

export default function App() {
  const [route, setRouteState] = useState(() => {
    if (window.location.pathname === "/admin/login") return "admin-login";
    if (window.location.pathname === "/admin") return "admin";
    return "customer";
  });
  const [adminAuthed, setAdminAuthed] = useState(() => localStorage.getItem("sheltonAdminAuthed") === "true");
  const [catFilter, setCatFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [tools, setTools] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  function setRoute(nextRoute) {
    const path = nextRoute === "admin" ? "/admin" : nextRoute === "admin-login" ? "/admin/login" : "/";
    window.history.pushState({}, "", path);
    setRouteState(nextRoute);
  }

  useEffect(() => {
    let ignore = false;

    api("/data")
      .then((data) => {
        if (ignore) return;
        setCategories(data.categories);
        setTools(data.tools);
        setReviews(data.reviews);
        setStatus("ready");
      })
      .catch((err) => {
        if (ignore) return;
        setError(err.message);
        setStatus("error");
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function syncRoute() {
      if (window.location.pathname === "/admin/login") setRouteState("admin-login");
      else if (window.location.pathname === "/admin") setRouteState("admin");
      else setRouteState("customer");
    }

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  async function handleSubmitReview(review) {
    const saved = await api("/reviews", { method: "POST", body: JSON.stringify(review) });
    setReviews((prev) => [...prev, saved]);
  }

  async function handleApprove(id) {
    const updated = await api(`/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ status: "approved" }) });
    setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function handleUpdateReview(id, updates) {
    const updated = await api(`/reviews/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }

  async function handleReject(id) {
    await api(`/reviews/${id}`, { method: "DELETE" });
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleComment(id, comment) {
    const updated = await api(`/reviews/${id}/comments`, { method: "POST", body: JSON.stringify(comment) });
    setReviews((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function handleAddTool(tool) {
    const saved = await api("/tools", { method: "POST", body: JSON.stringify(tool) });
    setTools((prev) => [...prev, saved]);
  }

  async function handleAddCategory(category) {
    const saved = await api("/categories", { method: "POST", body: JSON.stringify(category) });
    setCategories((prev) => [...prev, saved]);
    return saved;
  }

  async function handleUpdateCategory(id, category) {
    const updated = await api(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(category) });
    setCategories((prev) => prev.map((item) => (item.id === id ? updated : item)));
    return updated;
  }

  async function handleUpdatePrice(id, prices) {
    const updated = await api(`/tools/${id}`, { method: "PATCH", body: JSON.stringify(prices) });
    setTools((prev) => prev.map((tool) => (tool.id === id ? updated : tool)));
  }

  const pendingCount = reviews.filter((review) => review.status === "pending").length;
  const approvedCount = reviews.filter((review) => review.status === "approved").length;

  if (route === "admin-login") {
    return (
      <AdminLogin
        onLogin={() => {
          localStorage.setItem("sheltonAdminAuthed", "true");
          setAdminAuthed(true);
          setRoute("admin");
        }}
      />
    );
  }

  if (route === "admin" && !adminAuthed) {
    window.history.replaceState({}, "", "/admin/login");
    return (
      <AdminLogin
        onLogin={() => {
          localStorage.setItem("sheltonAdminAuthed", "true");
          setAdminAuthed(true);
          setRoute("admin");
        }}
      />
    );
  }

  return (
    <AppShell
      route={route}
      setRoute={setRoute}
      categories={categories}
      selectedCategory={catFilter}
      onCategoryChange={setCatFilter}
      toolsCount={tools.length}
      pendingCount={pendingCount}
      approvedCount={approvedCount}
      status={status}
      error={error}
      onLogout={() => {
        localStorage.removeItem("sheltonAdminAuthed");
        setAdminAuthed(false);
        setRoute("admin-login");
      }}
    >
      {route === "customer" && <CustomerPortal categories={categories} tools={tools} reviews={reviews} catFilter={catFilter} onCategoryChange={setCatFilter} onSubmitReview={handleSubmitReview} onComment={handleComment} />}
      {route === "admin" && <AdminPanel categories={categories} tools={tools} reviews={reviews} onApprove={handleApprove} onReject={handleReject} onUpdateReview={handleUpdateReview} onComment={handleComment} onAddTool={handleAddTool} onUpdatePrice={handleUpdatePrice} onAddCategory={handleAddCategory} onUpdateCategory={handleUpdateCategory} />}
    </AppShell>
  );
}


