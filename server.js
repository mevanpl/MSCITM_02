const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4000;
const dataPath = path.join(__dirname, 'data', 'store.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  const raw = fs.readFileSync(dataPath, 'utf8');
  return JSON.parse(raw);
}

function saveData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
}

function getOverallRating(review) {
  const categories = [
    review.performance,
    review.customerService,
    review.supportServices,
    review.afterSales,
    review.miscellaneous,
  ];
  return categories.reduce((sum, value) => sum + Number(value), 0) / categories.length;
}

function parseDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calculateRentalCost(tool, start, end) {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return null;
  const hours = ms / (1000 * 60 * 60);
  const days = Math.ceil(hours / 24);
  const weeks = Math.ceil(days / 7);
  const hourlyCost = hours * tool.rateHourly;
  const dailyCost = days * tool.rateDaily;
  const weeklyCost = weeks * tool.rateWeekly;
  return {
    durationHours: Number(hours.toFixed(2)),
    durationDays: days,
    durationWeeks: weeks,
    hourlyCost: Number(hourlyCost.toFixed(2)),
    dailyCost: Number(dailyCost.toFixed(2)),
    weeklyCost: Number(weeklyCost.toFixed(2)),
    bestSuggested: Math.min(hourlyCost, dailyCost, weeklyCost).toFixed(2),
  };
}

app.get('/api/categories', (req, res) => {
  const data = loadData();
  res.json(data.categories);
});

app.get('/api/tools', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const category = (req.query.category || '').trim().toLowerCase();
  const data = loadData();
  let tools = data.tools;
  if (category) {
    tools = tools.filter((tool) => tool.category.toLowerCase() === category);
  }
  if (q) {
    tools = tools.filter((tool) =>
      tool.name.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.category.toLowerCase().includes(q)
    );
  }
  const toolSummaries = tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    category: tool.category,
    description: tool.description,
    image: tool.image,
    rateHourly: tool.rateHourly,
    rateDaily: tool.rateDaily,
    rateWeekly: tool.rateWeekly,
    overallRating: tool.reviews.length ? Number((tool.reviews.reduce((sum, r) => sum + getOverallRating(r), 0) / tool.reviews.length).toFixed(2)) : null,
    reviewCount: tool.reviews.length,
  }));
  res.json(toolSummaries);
});

app.get('/api/tools/:id', (req, res) => {
  const data = loadData();
  const tool = data.tools.find((t) => t.id === req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  const approvedReviews = tool.reviews.filter((review) => review.approved);
  const averageRating = approvedReviews.length ? Number((approvedReviews.reduce((sum, review) => sum + getOverallRating(review), 0) / approvedReviews.length).toFixed(2)) : null;
  res.json({
    ...tool,
    overallRating: averageRating,
    reviews: approvedReviews,
  });
});

app.post('/api/reviews', (req, res) => {
  const data = loadData();
  const { toolId, author, title, body, performance, customerService, supportServices, afterSales, miscellaneous } = req.body;
  const tool = data.tools.find((t) => t.id === toolId);
  if (!tool) return res.status(400).json({ error: 'Invalid tool ID' });
  const review = {
    id: uuid(),
    author: author || 'Anonymous',
    title: title || 'No title',
    body: body || '',
    performance: Number(performance) || 0,
    customerService: Number(customerService) || 0,
    supportServices: Number(supportServices) || 0,
    afterSales: Number(afterSales) || 0,
    miscellaneous: Number(miscellaneous) || 0,
    overallRating: null,
    approved: false,
    submittedAt: new Date().toISOString(),
    comments: [],
    companyResponse: null,
  };
  review.overallRating = Number(getOverallRating(review).toFixed(2));
  tool.reviews.push(review);
  saveData(data);
  res.status(201).json({ message: 'Review submitted and pending moderation', reviewId: review.id });
});

app.post('/api/reviews/:reviewId/comments', (req, res) => {
  const data = loadData();
  const { author, body } = req.body;
  const review = data.tools.flatMap((tool) => tool.reviews).find((r) => r.id === req.params.reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  const comment = {
    id: uuid(),
    author: author || 'Anonymous',
    body: body || '',
    submittedAt: new Date().toISOString(),
  };
  review.comments.push(comment);
  saveData(data);
  res.status(201).json(comment);
});

app.post('/api/reviews/:reviewId/response', (req, res) => {
  const data = loadData();
  const { response } = req.body;
  const review = data.tools.flatMap((tool) => tool.reviews).find((r) => r.id === req.params.reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  review.companyResponse = response || null;
  saveData(data);
  res.json({ message: 'Company response saved' });
});

app.post('/api/calculate', (req, res) => {
  const { toolId, startAt, endAt } = req.body;
  const data = loadData();
  const tool = data.tools.find((t) => t.id === toolId);
  if (!tool) return res.status(400).json({ error: 'Invalid tool ID' });
  const start = parseDateTime(startAt);
  const end = parseDateTime(endAt);
  if (!start || !end) return res.status(400).json({ error: 'Invalid date/time format' });
  const result = calculateRentalCost(tool, start, end);
  if (!result) return res.status(400).json({ error: 'End date must be after start date' });
  res.json(result);
});

app.get('/api/admin/reviews', (req, res) => {
  const data = loadData();
  const pending = data.tools.flatMap((tool) =>
    tool.reviews.filter((review) => !review.approved).map((review) => ({ ...review, toolId: tool.id, toolName: tool.name }))
  );
  res.json(pending);
});

app.post('/api/admin/reviews/:reviewId/approve', (req, res) => {
  const data = loadData();
  const review = data.tools.flatMap((tool) => tool.reviews).find((r) => r.id === req.params.reviewId);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  review.approved = true;
  saveData(data);
  res.json({ message: 'Review approved' });
});

app.get('/api/admin/tools', (req, res) => {
  const data = loadData();
  res.json(data.tools);
});

app.post('/api/admin/tools', (req, res) => {
  const data = loadData();
  const { name, category, description, image, rateHourly, rateDaily, rateWeekly } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Name and category are required' });
  const tool = {
    id: uuid(),
    name,
    category,
    description: description || '',
    image: image || '/images/placeholder.png',
    rateHourly: Number(rateHourly) || 0,
    rateDaily: Number(rateDaily) || 0,
    rateWeekly: Number(rateWeekly) || 0,
    reviews: [],
  };
  data.tools.push(tool);
  if (!data.categories.includes(category)) data.categories.push(category);
  saveData(data);
  res.status(201).json(tool);
});

app.put('/api/admin/tools/:id', (req, res) => {
  const data = loadData();
  const tool = data.tools.find((t) => t.id === req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  const { name, category, description, image, rateHourly, rateDaily, rateWeekly } = req.body;
  if (name) tool.name = name;
  if (category) tool.category = category;
  if (description) tool.description = description;
  if (image) tool.image = image;
  if (rateHourly !== undefined) tool.rateHourly = Number(rateHourly);
  if (rateDaily !== undefined) tool.rateDaily = Number(rateDaily);
  if (rateWeekly !== undefined) tool.rateWeekly = Number(rateWeekly);
  if (category && !data.categories.includes(category)) data.categories.push(category);
  saveData(data);
  res.json(tool);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Shelton Tool-Hire API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
