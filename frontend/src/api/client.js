import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Health check function
export async function checkHealth() {
  const response = await client.get('/health');
  return response.data;
}

export default client;
