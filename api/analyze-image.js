// api/analyze-image.js
import { Service } from '@volcengine/openapi';

export default async function handler(req, res) {
  // 1. 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64 } = req.body;

  // 2. 检查必要参数
  if (!imageBase64) {
    return res.status(400). json({ error: 'Missing image data' });
  }

  // 3. 从环境变量读取火山引擎凭证和接入点ID
  const accessKey = process.env.VOLC_ACCESS_KEY;
  const secretKey = process.env.VOLC_SECRET_KEY;
  const endpointId = process.env.VOLC_ENDPOINT_ID;

  if (!accessKey || !secretKey || !endpointId) {
    console.error('Missing volcano engine credentials');
    return res.status(500).json({ error: 'Server configuration error: missing API credentials' });
  }

  try {
    // 4. 初始化火山引擎服务
    const volcService = new Service({
      host: 'ark.cn-beijing.volces.com',
      serviceName: 'ark',
      region: 'cn-beijing',
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    });

    // 5. 构建请求体（使用 endpointId 作为模型）
    const requestBody = {
      model: endpointId,   // 直接使用推理接入点ID
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
      temperature: 0.2,
    };

    // 6. 发送请求到火山引擎
    const response = await volcService.fetch('api/v3/chat/completions', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Volcano Engine API error:', errorText);
      throw new Error(`Volcano Engine API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from AI model.');
    }

    // 7. 解析AI返回的JSON字符串
    let parsedData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', content);
      throw new Error('Invalid JSON response from AI.');
    }

    // 8. 返回结构化的数据给前端
    const result = {
      distance: parsedData.distance_km !== undefined && parsedData.distance_km !== null ? parsedData.distance_km : null,
      duration: parsedData.duration_min !== undefined && parsedData.duration_min !== null ? parsedData.duration_min : null,
      heartrate: parsedData.avg_heart_rate !== undefined && parsedData.avg_heart_rate !== null ? parsedData.avg_heart_rate : null,
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
}
