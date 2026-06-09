export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, apiUrl, apiKey, model } = req.body;

  if (!imageBase64 || !apiUrl || !apiKey) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请分析这张健身设备照片，提取距离(公里)、时长(分钟)、平均心率(次/分)。只返回JSON，例如：{"distance":5.2,"duration":30,"heartrate":145}。缺失字段返回null。' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
    }
  ];

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-v4-flash',
        messages,
        max_tokens: 300,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
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
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      parsed = JSON.parse(content);
    }

    const result = {
      distance: parsed.distance || parsed.distance_km || null,
      duration: parsed.duration || parsed.minutes || null,
      heartrate: parsed.heartrate || parsed.avg_heart_rate || null
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Serverless error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
