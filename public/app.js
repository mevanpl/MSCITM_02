const api = {
  categories: '/api/categories',
  tools: '/api/tools',
  tool: (id) => `/api/tools/${id}`,
  reviews: '/api/reviews',
  calculate: '/api/calculate',
};

const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const searchButton = document.getElementById('searchButton');
const toolList = document.getElementById('toolList');
const toolDetail = document.getElementById('toolDetail');

async function loadCategories() {
  const response = await fetch(api.categories);
  const categories = await response.json();
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function createRatingStars(value) {
  return value ? `${value.toFixed(1)} / 5` : 'No ratings yet';
}

function renderToolCard(tool) {
  const card = document.createElement('div');
  card.className = 'tool-card';
  card.innerHTML = `
    <img src="${tool.image}" alt="${tool.name}" />
    <div class="tool-summary">
      <h3>${tool.name}</h3>
      <p>${tool.category}</p>
      <p>${tool.description}</p>
      <p><strong>Hourly:</strong> £${tool.rateHourly} | <strong>Daily:</strong> £${tool.rateDaily} | <strong>Weekly:</strong> £${tool.rateWeekly}</p>
      <p><strong>Overall:</strong> ${createRatingStars(tool.overallRating)} (${tool.reviewCount} review${tool.reviewCount === 1 ? '' : 's'})</p>
      <button class="viewButton" data-id="${tool.id}">View details</button>
    </div>
  `;
  return card;
}

function renderTools(tools) {
  toolList.innerHTML = '';
  if (!tools.length) {
    toolList.innerHTML = '<p class="empty-state">No tools found for this search.</p>';
    return;
  }
  tools.forEach((tool) => toolList.appendChild(renderToolCard(tool)));
}

function showToolDetail(tool) {
  const reviewsHtml = tool.reviews.length ? tool.reviews.map((review) => `
    <article class="review-card">
      <h4>${review.title}</h4>
      <p><strong>${review.author}</strong> · ${new Date(review.submittedAt).toLocaleDateString()}</p>
      <p>${review.body}</p>
      <p>Performance: ${review.performance} | Customer service: ${review.customerService} | Support: ${review.supportServices} | After sales: ${review.afterSales} | Misc: ${review.miscellaneous}</p>
      ${review.companyResponse ? `<div class="company-response"><strong>Company Response:</strong><p>${review.companyResponse}</p></div>` : ''}
      ${review.comments.length ? `<div class="review-comments"><strong>Comments:</strong>${review.comments.map((c) => `<p><em>${c.author}:</em> ${c.body}</p>`).join('')}</div>` : ''}
    </article>`
  `).join('') : '<p>No published reviews yet.</p>';

  toolDetail.classList.remove('hidden');
  toolDetail.innerHTML = `
    <div class="detail-card">
      <button id="closeDetail">Close</button>
      <img src="${tool.image}" alt="${tool.name}" />
      <div class="detail-content">
        <h2>${tool.name}</h2>
        <p><strong>Category:</strong> ${tool.category}</p>
        <p>${tool.description}</p>
        <p><strong>Pricing:</strong> £${tool.rateHourly}/hr | £${tool.rateDaily}/day | £${tool.rateWeekly}/week</p>
        <p><strong>Average rating:</strong> ${createRatingStars(tool.overallRating)}</p>
        <section class="calculator">
          <h3>Cost calculator</h3>
          <label>Start: <input id="startAt" type="datetime-local" /></label>
          <label>End: <input id="endAt" type="datetime-local" /></label>
          <button id="calculateButton">Calculate</button>
          <div id="calcResult"></div>
        </section>
        <section class="review-form">
          <h3>Leave a review</h3>
          <input id="reviewAuthor" placeholder="Your name" />
          <input id="reviewTitle" placeholder="Review title" />
          <textarea id="reviewBody" placeholder="Write your review"></textarea>
          <div class="rating-row">
            <label>Performance <input id="perfRating" type="number" min="1" max="5" /></label>
            <label>Customer service <input id="serviceRating" type="number" min="1" max="5" /></label>
          </div>
          <div class="rating-row">
            <label>Support <input id="supportRating" type="number" min="1" max="5" /></label>
            <label>After sales <input id="afterRating" type="number" min="1" max="5" /></label>
            <label>Misc <input id="miscRating" type="number" min="1" max="5" /></label>
          </div>
          <button id="submitReview">Submit review</button>
          <p class="hint">Reviews are moderated and published once approved.</p>
        </section>
        <section class="review-list">
          <h3>Published reviews</h3>
          ${reviewsHtml}
        </section>
      </div>
    </div>
  `;

  document.getElementById('closeDetail').addEventListener('click', () => {
    toolDetail.classList.add('hidden');
  });

  document.getElementById('calculateButton').addEventListener('click', async () => {
    const startAt = document.getElementById('startAt').value;
    const endAt = document.getElementById('endAt').value;
    const response = await fetch(api.calculate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId: tool.id, startAt, endAt }),
    });
    const result = await response.json();
    const resultEl = document.getElementById('calcResult');
    if (!response.ok) {
      resultEl.textContent = result.error || 'Calculation error';
      return;
    }
    resultEl.innerHTML = `
      <p>Duration: ${result.durationHours} hours (~${result.durationDays} days, ${result.durationWeeks} weeks)</p>
      <p>Hourly cost: £${result.hourlyCost}</p>
      <p>Daily cost: £${result.dailyCost}</p>
      <p>Weekly cost: £${result.weeklyCost}</p>
      <p><strong>Suggested best cost:</strong> £${result.bestSuggested}</p>
    `;
  });

  document.getElementById('submitReview').addEventListener('click', async () => {
    const payload = {
      toolId: tool.id,
      author: document.getElementById('reviewAuthor').value,
      title: document.getElementById('reviewTitle').value,
      body: document.getElementById('reviewBody').value,
      performance: document.getElementById('perfRating').value,
      customerService: document.getElementById('serviceRating').value,
      supportServices: document.getElementById('supportRating').value,
      afterSales: document.getElementById('afterRating').value,
      miscellaneous: document.getElementById('miscRating').value,
    };
    const response = await fetch(api.reviews, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    alert(result.message || 'Review submitted');
  });
}

async function loadTools() {
  const params = new URLSearchParams();
  if (searchInput.value) params.set('q', searchInput.value);
  if (categoryFilter.value) params.set('category', categoryFilter.value);
  const response = await fetch(`${api.tools}?${params.toString()}`);
  const tools = await response.json();
  renderTools(tools);
}

toolList.addEventListener('click', async (event) => {
  const button = event.target.closest('.viewButton');
  if (!button) return;
  const id = button.dataset.id;
  const response = await fetch(api.tool(id));
  const tool = await response.json();
  showToolDetail(tool);
});

searchButton.addEventListener('click', loadTools);
searchInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') loadTools();
});

window.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  await loadTools();
});
