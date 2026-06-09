export default async function handler(req, res) {
  // 记录请求方法
  console.log('Request method:', req.method);
  
  if (req.method !== 'POST') {
    console.log('Method not allowed - returning 405');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, apiUrl, apiKey, model } = req.body;
  console.log('Received request, has imageBase64:', !!imageBase64, 'apiUrl:', apiUrl);

  if (!imageBase64 || !apiUrl || !apiKey) {
    console.log('Missing parameters');
    return res.status(400).json({ error: 'Missing parameters' });
  }

  // ... 其余 AI 调用逻辑保持不变 ...

  try {
    // ... 调用 AI ...
    const result = { distance: 5.2, duration: 30, heartrate: 145 }; // 测试用
    console.log('AI call success, returning result');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Function error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
