const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');
const originalStore = fs.readFileSync(path.join(__dirname, '..', 'data', 'store.json'), 'utf8');

afterAll(() => {
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'store.json'), originalStore, 'utf8');
});

describe('Shelton Tool Hire API', () => {
  test('GET /api/categories returns six categories', async () => {
    const response = await request(app).get('/api/categories');
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(6);
  });

  test('GET /api/tools returns a list with tool summaries', async () => {
    const response = await request(app).get('/api/tools');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]).toHaveProperty('id');
  });

  test('POST /api/calculate returns cost details', async () => {
    const response = await request(app)
      .post('/api/calculate')
      .send({
        toolId: 'tool-001',
        startAt: '2026-09-08T09:00:00',
        endAt: '2026-09-10T15:00:00',
      });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('hourlyCost');
    expect(response.body.durationDays).toBe(3);
  });
});
