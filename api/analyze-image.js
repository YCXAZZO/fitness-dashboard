// api/analyze-image.js

export default async function handler(req, res) {
  // 允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const { imageBase64, apiUrl, apiKey, model } = req.body;

    // 参数检查
    if (!imageBase64 || !apiUrl || !apiKey) {
      return res.status(400).json({
        error: 'Missing parameters'
      });
    }

    // DeepSeek/OpenAI Vision Messages
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              '请分析这张健身设备照片（跑步机、划船机、骑行台等），从中提取以下数据：距离（公里）、时长（分钟）、平均心率（次/分）。如果没有对应数据则返回 null。只返回 JSON，不要解释。示例：{"distance":5.2,"duration":30,"heartrate":145}'
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

    // 请求 AI
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

    // AI 请求失败
    if (!response.ok) {
      const errorText = await response.text();

      console.error('AI API ERROR:', errorText);

      return res.status(response.status).json({
        error: 'AI service call failed',
        detail: errorText
      });
    }

    // AI 返回
    const data = await response.json();

    console.log('AI RESPONSE:', JSON.stringify(data, null, 2));

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: 'AI returned empty content'
      });
    }

    // 提取 JSON
    let parsed;

    try {
      // 去掉 markdown
      const cleaned = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // 提取 {}
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

      parsed = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : JSON.parse(cleaned);

    } catch (e) {
      console.error('JSON PARSE ERROR:', content);

      return res.status(500).json({
        error: 'Invalid JSON response from AI',
        raw: content
      });
    }

    // 标准化字段
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
        parsed.heart_rate ??
        null
    };

    // 返回结果
    return res.status(200).json(result);

  } catch (error) {

    console.error('SERVER ERROR:', error);

    return res.status(500).json({
      error: 'Internal server error',
      detail: error.message
    });
  }
}
