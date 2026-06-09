// api/analyze-image.js
export default async function handler(req, res) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, apiUrl, apiKey, model } = req.body;

  if (!imageBase64 || !apiUrl || !apiKey) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  // 构造多模态请求消息（DeepSeek-VL 或 OpenAI 格式）
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请分析这张健身设备照片（跑步机、划船机、骑行台等），从中提取以下数据：距离（公里）、时长（分钟）、平均心率（次/分）。如果图片中没有某项数据，就返回 null。请以 JSON 格式返回，例如：{"distance": 5.2, "duration": 30, "heartrate": 145}。只返回 JSON，不要有其他文字。' },
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
        model: model || 'deepseek-chat',
        messages: messages,
        max_tokens: 300,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API 错误:', errorText);
      return res.status(response.status).json({ error: 'AI 服务调用失败' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'AI 未返回有效内容' });
    }

    // 尝试解析 JSON
    let parsed;
    try {
      // 提取 JSON 部分（可能包含 markdown 代码块）
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (e) {
      console.error('JSON 解析失败:', content);
      return res.status(500).json({ error: 'AI 返回格式错误' });
    }

    // 规范化字段名
    const result = {
      distance: parsed.distance || parsed.distance_km || null,
      duration: parsed.duration || parsed.minutes || null,
      heartrate: parsed.heartrate || parsed.avg_heart_rate || null
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Serverless 函数错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
}
