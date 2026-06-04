fetch('http://localhost:3000/api/sync', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
