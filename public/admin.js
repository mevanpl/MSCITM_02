const pendingReviewsContainer = document.getElementById('pendingReviews');
const toolAdminList = document.getElementById('toolAdminList');
const loadToolsButton = document.getElementById('loadTools');

async function fetchPendingReviews() {
  const response = await fetch('/api/admin/reviews');
  const reviews = await response.json();
  pendingReviewsContainer.innerHTML = '';
  if (!reviews.length) {
    pendingReviewsContainer.innerHTML = '<p class="empty-state">No pending reviews.</p>';
    return;
  }
  reviews.forEach((review) => {
    const div = document.createElement('div');
    div.className = 'pending-review';
    div.innerHTML = `
      <h3>${review.title}</h3>
      <p><strong>${review.author}</strong> on ${review.toolName}</p>
      <p>${review.body}</p>
      <p>Ratings: Perf ${review.performance}, Service ${review.customerService}, Support ${review.supportServices}, After sales ${review.afterSales}, Misc ${review.miscellaneous}</p>
      <button data-id="${review.id}" class="approveReview">Approve</button>
    `;
    pendingReviewsContainer.appendChild(div);
  });
}

async function fetchTools() {
  const response = await fetch('/api/admin/tools');
  const tools = await response.json();
  toolAdminList.innerHTML = '';
  tools.forEach((tool) => {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.innerHTML = `
      <img src="${tool.image}" alt="${tool.name}" />
      <div class="tool-summary">
        <h3>${tool.name}</h3>
        <p>${tool.category}</p>
        <p>${tool.description}</p>
        <p><strong>Hourly</strong> £${tool.rateHourly} | <strong>Daily</strong> £${tool.rateDaily} | <strong>Weekly</strong> £${tool.rateWeekly}</p>
        <button data-id="${tool.id}" class="editTool">Edit</button>
      </div>
    `;
    toolAdminList.appendChild(card);
  });
}

pendingReviewsContainer.addEventListener('click', async (event) => {
  const button = event.target.closest('.approveReview');
  if (!button) return;
  const reviewId = button.dataset.id;
  await fetch(`/api/admin/reviews/${reviewId}/approve`, { method: 'POST' });
  await fetchPendingReviews();
});

loadToolsButton.addEventListener('click', fetchTools);

window.addEventListener('DOMContentLoaded', fetchPendingReviews);
