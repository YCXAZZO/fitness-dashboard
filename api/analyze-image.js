// api/analyze-image.js
export default async function handler(req, res) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, apiUrl, apiKey, model } = req.body;

  // 参数校验
  if (!imageBase64 || !apiUrl || !apiKey) {
    return res.status(400).json({ error: 'Missing required parameters: imageBase64, apiUrl, apiKey' });
  }

  // 构建 messages，包含图片（OpenAI 格式）
  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `请分析这张健身设备屏幕或运动手表截图，从中提取以下数据（如果存在）：
- distance: 距离（公里 km）
- duration: 时长（分钟 min）
- heartrate: 平均心率（bpm）
- pace: 配速（可选，格式如 "5'30""）
- cadence: 步频（可选，次/分钟）
- power: 功率（可选，瓦特）
- 其他运动专属数据（如桨频、踏频、坡度等），请按字段名原样返回。

请只返回一个 JSON 对象，不要包含其他解释文字。数值使用数字类型，字符串使用双引号。如果某项数据不存在，不要包含该字段。示例输出：
{"distance":5.2,"duration":28,"heartrate":145,"pace":"5'23\"","cadence":82}
`
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

  const requestBody = {
    model: model || 'deepseek-chat',  // 注意：DeepSeek-VL 模型名可能需要指定为 'deepseek-vl'，用户可自行填写
    messages: messages,
    max_tokens: 500,
    temperature: 0.2
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return res.status(response.status).json({ error: `AI API returned ${response.status}: ${errorText}` });
    }

    const data = await response.json();
    let aiText = data.choices?.[0]?.message?.content || '';
    
    // 尝试从 AI 返回的文本中提取 JSON
    let parsed;
    try {
      // 查找第一个 { 到最后一个 } 之间的内容
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', aiText);
      return res.status(500).json({ error: 'AI response was not valid JSON', raw: aiText });
    }

    // 可选：字段名映射（如果 AI 返回了不同的大小写或命名）
    const result = {};
    const fieldMap = {
      distance: 'distance',
      duration: 'duration',
      heartrate: 'heartrate',
      pace: 'pace',
      cadence: 'cadence',
      power: 'power',
      桨频: 'stroke_rate',
      踏频: 'cadence',
      坡度: 'grade'
    };
    for (const [key, value] of Object.entries(parsed)) {
      const mappedKey = fieldMap[key] || key;
      result[mappedKey] = value;
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
