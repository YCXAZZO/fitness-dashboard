// api/analyze-image.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  const apiKey = process.env.VOLC_API_KEY;
  const endpoint = process.env.VOLC_ENDPOINT_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
  const model = process.env.VOLC_MODEL_NAME || 'doubao-vision-pro-32k';

  if (!apiKey) {
    console.error('Missing VOLC_API_KEY');
    return res.status(500).json({ error: 'Server configuration error: missing API key' });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请从这张照片中提取运动数据，以纯JSON格式返回，不要包含其他解释文字。只提取照片中明确显示的数字和单位。需要包含以下字段：distance_km（公里数）、duration_min（分钟数）、avg_heart_rate（平均心率）。如果照片中没有明确显示某字段，就返回null。示例输出格式：{"distance_km": 5.0, "duration_min": 30, "avg_heart_rate": 145}'
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Volcano Engine API error:', errorText);
      return res.status(response.status).json({ error: 'AI service call failed' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'AI returned no content' });
    }

    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let parsed;
    try {
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch (e) {
      console.error('JSON parse error:', content);
      return res.status(500).json({ error: 'Invalid JSON response from AI' });
    }

    const result = {
      distance: parsed.distance_km ?? parsed.distance ?? null,
      duration: parsed.duration_min ?? parsed.duration ?? null,
      heartrate: parsed.avg_heart_rate ?? parsed.heartrate ?? null
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
}
