// api/analyze-image.js

export default async function handler(req, res) {
  // 允许跨域（可选）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    console.log('===== REQUEST BODY =====');
    console.log(req.body);

    const {
      imageBase64,
      apiUrl,
      apiKey,
      model
    } = req.body || {};

    // 打印详细字段
    console.log('imageBase64 exists:', !!imageBase64);
    console.log('apiUrl:', apiUrl);
    console.log('apiKey exists:', !!apiKey);
    console.log('model:', model);

    // 参数检查
    if (!imageBase64) {
      return res.status(400).json({
        error: 'Missing imageBase64'
      });
    }

    if (!apiUrl) {
      return res.status(400).json({
        error: 'Missing apiUrl'
      });
    }

    if (!apiKey) {
      return res.status(400).json({
        error: 'Missing apiKey'
      });
    }

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              '请分析这张健身设备照片（跑步机、划船机、骑行台等），从中提取以下数据：距离（公里）、时长（分钟）、平均心率（次/分）。如果图片中没有某项数据，就返回 null。请以 JSON 格式返回，例如：{"distance":5.2,"duration":30,"heartrate":145}。只返回 JSON。'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }
    ];

    console.log('===== CALLING AI API =====');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages,
        max_tokens: 300,
        temperature: 0.2
      })
    });

    console.log('AI status:', response.status);

    // AI 返回错误
    if (!response.ok) {
      const errorText = await response.text();

      console.log('===== AI ERROR =====');
      console.log(errorText);

      return res.status(response.status).json({
        error: errorText
      });
    }

    const data = await response.json();

    console.log('===== AI RESPONSE =====');
    console.log(JSON.stringify(data, null, 2));

    const content =
      data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: 'AI returned empty content'
      });
    }

    // 提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    let parsed;

    try {
      parsed = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : JSON.parse(content);
    } catch (e) {
      console.log('===== JSON PARSE ERROR =====');
      console.log(content);

      return res.status(500).json({
        error: 'Invalid JSON from AI',
        raw: content
      });
    }

    const result = {
      distance:
        parsed.distance ??
        parsed.distance_km ??
        null,

      duration:
        parsed.duration ??
        parsed.minutes ??
        null,

      heartrate:
        parsed.heartrate ??
        parsed.avg_heart_rate ??
        null
    };

    console.log('===== FINAL RESULT =====');
    console.log(result);

    return res.status(200).json(result);

  } catch (error) {
    console.log('===== SERVER ERROR =====');
    console.error(error);

    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
