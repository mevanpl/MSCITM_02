# Shelton Tool Hire Prototype

A prototype review portal and rental calculator for a tool-hire business. It includes:

- Searchable tool catalog by category and keywords.
- Tool detail pages with hourly/daily/weekly hire pricing.
- Rental cost calculator for a proposed rental period.
- Review submission for performance, customer service, support, after sales, and miscellaneous categories.
- Review moderation flow with admin approval before publication.
- Review comments and company responses.
- Admin portal for pending review moderation and tool management.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the app:
   ```bash
   npm start
   ```

3. Open the portal in your browser:
   - Customer portal: `http://localhost:4000`
   - Admin portal: `http://localhost:4000/admin.html`

## Design decisions

- Categories are based on typical rental segments: Building & Construction, Cleaning, Decorating, Landscaping, Electrical & Heating, Plumbing.
- Reviews are stored with rating subcategories and require admin approval before they appear publicly.
- The cost calculator compares hourly, daily and weekly pricing to help customers choose the best duration.
- The admin portal supports moderation and tool pricing updates without changing the front-end customer experience.

## API endpoints

- `GET /api/categories`
- `GET /api/tools?q=&category=`
- `GET /api/tools/:id`
- `POST /api/reviews`
- `POST /api/reviews/:reviewId/comments`
- `POST /api/reviews/:reviewId/response`
- `POST /api/calculate`
- `GET /api/admin/reviews`
- `POST /api/admin/reviews/:reviewId/approve`
- `GET /api/admin/tools`
- `POST /api/admin/tools`
- `PUT /api/admin/tools/:id`

## Testing

Run unit tests with:

```bash
npm test
```
