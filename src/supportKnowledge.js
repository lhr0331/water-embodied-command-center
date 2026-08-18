const supportTopics = [
  {
    id: "overview",
    title: "系统整体使用流程",
    keywords: ["系统怎么用", "软件怎么用", "整体使用", "系统使用", "功能介绍", "功能有哪些", "操作流程", "使用流程", "如何使用"],
    lines: [
      "正式值守按“启动系统—检查网关—确认设备与传感器—核对地图和围栏—处置告警—提交任务申请—班后留痕”的顺序使用。",
      "首次接入先在封闭场地验证单设备遥测、告警和围栏；通过后再进行多设备协同感知与任务编排。",
      "演示版用于展示三维地图、设备、围栏、传感、告警和任务流程；真实设备数据与控制必须进入正式现场集成环境。",
    ],
    related: ["正式系统怎样启动？", "设备如何接入？", "告警出现后怎么处理？"],
  },
  {
    id: "startup",
    title: "系统启动与运行模式",
    keywords: ["启动", "激活", "打开系统", "安装", "部署", "本地运行", "正式系统", "正式版", "演示版", "网页打不开", "白屏", "8080", "5173"],
    lines: [
      "客户演示：直接打开 GitHub Pages 链接即可体验全部功能，无需安装；演示数据不代表真实现场。",
      "本地演练：在项目目录执行 npm install，再运行 npm run dev:realtime，并访问 http://127.0.0.1:5173。",
      "正式现场入口：首次双击“首次部署正式系统.cmd”；以后双击“启动正式系统.cmd”，访问 http://127.0.0.1:8080。",
    ],
    related: ["正式系统打不开怎么排查？", "演示版和正式版有什么区别？"],
  },
  {
    id: "device-access",
    title: "设备接入与边缘适配器",
    keywords: ["接入", "连接", "设备", "无人机", "飞行器", "无人船", "无人艇", "usv", "轮式机器人", "机器人", "机器狗", "四足机器人", "飞控", "mavlink", "mqtt", "ros2", "ros 2", "sdk", "适配器", "遥测", "deviceid"],
    lines: [
      "先为每台设备登记固定且唯一的 deviceId；无人机使用 MAVLink 2/厂商 SDK，无人船使用 MQTT 5，轮式机器人和机器狗使用 ROS 2/厂商 SDK。",
      "在现场工控机部署只读边缘适配器，将心跳、位置、电量、链路、速度和传感器统一转换后上报至 http://127.0.0.1:8878/api/v1/ingest/telemetry。",
      "网页不直接连接飞控、电机或 ROS 控制话题；返航、起降、航线、导航等真实控制必须由经过安全评审的现场控制器执行。",
    ],
    related: ["无人机接入后看不到数据怎么办？", "设备接入后如何验收？"],
  },
  {
    id: "map",
    title: "三维地图与空间部署",
    keywords: ["地图", "三维", "3d", "拖动", "平移", "缩放", "放大", "旋转", "鸟瞰", "正射", "视角", "定位", "底图", "扫描", "gis", "坐标"],
    lines: [
      "在三维地图空白处按住鼠标左键拖动可平移，按住右键拖动可旋转视角；滚轮或地图工具栏的 + / − 可缩放。",
      "可切换正射、鸟瞰和大坝细节视角；点击设备标记可查看该设备的状态、电量、链路和速度。",
      "实际工程地图上线时，应由坐标转换服务把设备原始坐标映射至 GIS/DEM 底图；先用现场地标校准，再用于部署调整。",
    ],
    related: ["如何用无人机扫描后更新部署位置？", "电子围栏怎么在地图上绘制？"],
  },
  {
    id: "fence",
    title: "电子围栏与作业边界",
    keywords: ["电子围栏", "围栏", "禁入", "限高", "水面作业区", "边界", "区域", "点选", "保存区域", "越界"],
    lines: [
      "在左侧功能区点击“电子围栏”，填写区域名称并选择围栏类型。",
      "点击“开始在地图点选”，在三维地图上连续选择至少 3 个边界点；可撤销最近一个点，确认后点击“保存区域”。",
      "网页保存的是平台围栏记录。正式使用还必须将同一版本、坐标系和有效期同步至设备侧安全控制器，并由安全负责人复核。",
    ],
    related: ["围栏保存后为什么设备仍能越界？", "如何创建水面作业区？"],
  },
  {
    id: "monitoring",
    title: "传感监测与视频接入",
    keywords: ["传感器", "传感监测", "监测", "水质", "ph", "浊度", "水温", "温度", "振动", "气体", "坡度", "电量", "视频", "实时画面", "摄像头", "rtsp", "webrtc", "hls"],
    lines: [
      "点击“传感监测”，切换设备即可查看标准化读数：无人机高度/风速/云台温度；无人船 pH/浊度/水温；机器人和机器狗的温度、振动或气体等。",
      "正式遥测应由边缘适配器每 1–5 秒持续上报；演示版中的刷新数值仅用于功能体验。",
      "“实时画面”需要独立视频边缘网关把厂商 RTSP 或私有视频流转换为经鉴权的 WebRTC、HLS 或受控 RTSP；浏览器不能直接访问设备相机。",
    ],
    related: ["传感器数据不刷新怎么办？", "怎样接入现场视频流？"],
  },
  {
    id: "alerts",
    title: "告警核验与事件处置",
    keywords: ["告警", "报警", "异常", "风险", "事件", "超阈值", "失联", "低电量", "处置", "确认告警", "告警处理"],
    lines: [
      "点击右侧任意告警进入“事件管理”，先核验来源、位置、置信度和现场证据，再按预案确认、移交或发起协同任务申请。",
      "适配器发现失联、低电量、定位无效或传感器超阈值时，应立即向 http://127.0.0.1:8878/api/v1/ingest/alerts 上报告警。",
      "急停、碰撞、越界或人员风险以现场急停、人工接管和应急预案为最高优先级，不能仅依据网页状态处置。",
    ],
    related: ["如何提交协同巡检任务？", "没有收到告警怎么排查？"],
  },
  {
    id: "mission",
    title: "协同编排与任务申请",
    keywords: ["任务", "调度", "协同", "编排", "计划", "发布计划", "下达", "启动任务", "巡检", "审批", "派发"],
    lines: [
      "在“协同编排”中按设备类型筛选任务，核对时间窗口、巡检区域和风险限制后，再点击“发布计划”或提交任务申请。",
      "演示版的“启动任务”只改变演练状态；正式系统中的任务会进入人工审批与边缘适配器流程，不会由浏览器直接驱动设备。",
      "启用真实任务前，应完成操作者身份、审批令牌、围栏版本、设备安全状态、急停/人工接管和执行回执的现场联调。",
    ],
    related: ["告警后怎样发起协同任务？", "为什么任务一直待现场审批？"],
  },
  {
    id: "safety",
    title: "安全控制与现场验收",
    keywords: ["真实控制", "控制设备", "返航", "起飞", "降落", "航线", "导航", "急停", "人工接管", "安全", "验收", "封闭场地", "权限"],
    lines: [
      "当前正式平台可用于监测、告警、围栏和任务申请；浏览器不会直接发出真实飞行、航行或运动控制指令。",
      "真实控制接入前必须完成：设备侧安全控制器、身份与权限、审批和审计、围栏同步、急停、失联保护、低电量策略、人工接管及回执验证。",
      "按“网关—在线—遥测—地图—告警—围栏—安全”顺序，在封闭场地先单设备、后多设备验收，并由现场安全负责人签字。",
    ],
    related: ["正式系统能直接控制无人机吗？", "线下测试的验收步骤是什么？"],
  },
  {
    id: "share",
    title: "客户访问与交付",
    keywords: ["客户", "分享", "发给别人", "网址", "链接", "github", "github pages", "在线", "访问", "部署网站", "大陆", "国内访问", "域名"],
    lines: [
      "客户演示链接可直接在浏览器打开，无需登录：https://lhr0331.github.io/water-embodied-command-center/。",
      "GitHub Pages 适合公开演示和软件说明；不要上传真实设备密钥、现场账号、证书、Token、生产数据或控制接口地址。",
      "如需面向中国大陆长期稳定交付，建议迁移至已备案的国内云服务器、自有域名和受控访问体系。",
    ],
    related: ["如何把演示版给客户？", "正式系统怎样部署到现场工控机？"],
  },
  {
    id: "troubleshooting",
    title: "故障排查",
    keywords: ["打不开", "无法打开", "连不上", "连接不上", "离线", "不显示", "看不到", "不刷新", "失败", "报错", "异常", "无数据", "没有数据", "没有视频"],
    lines: [
      "正式页面无法打开时，先确认是否已运行“启动正式系统.cmd”，再访问 http://127.0.0.1:8080/health 检查 status 是否为 ok。",
      "设备未出现或数据不刷新时，依次检查边缘适配器是否运行、deviceId 是否唯一、上报地址是否为 127.0.0.1:8878、协议链路与时间戳是否正常。",
      "围栏未生效、无视频或任务待审批都不应通过网页绕过安全机制；分别核对设备侧围栏版本、视频网关鉴权和审批/边缘适配器状态。",
    ],
    related: ["无人机接入后看不到数据怎么办？", "正式系统打不开怎么排查？"],
  },
];

const keywordGroups = [
  { label: "无人机", terms: ["无人机", "飞行器", "飞控", "mavlink", "飞行"] },
  { label: "无人船", terms: ["无人船", "无人艇", "usv", "船", "mqtt", "水面"] },
  { label: "轮式机器人", terms: ["轮式机器人", "机器人", "泵站", "闸站", "ugv"] },
  { label: "机器狗", terms: ["机器狗", "四足", "qgv", "廊道", "边坡"] },
  { label: "设备接入", terms: ["接入", "连接", "适配器", "遥测", "deviceid"] },
  { label: "三维地图", terms: ["地图", "三维", "3d", "缩放", "旋转", "平移", "底图"] },
  { label: "电子围栏", terms: ["围栏", "禁入", "限高", "边界", "越界"] },
  { label: "传感监测", terms: ["传感", "水质", "ph", "浊度", "视频", "rtsp", "温度", "气体"] },
  { label: "告警处置", terms: ["告警", "报警", "超阈值", "失联", "低电量", "事件"] },
  { label: "任务调度", terms: ["任务", "调度", "协同", "编排", "审批", "计划"] },
  { label: "安全控制", terms: ["急停", "人工接管", "真实控制", "返航", "起飞", "降落"] },
  { label: "客户交付", terms: ["客户", "分享", "链接", "github", "域名", "大陆"] },
];

const questionTypes = [
  { label: "故障排查", terms: ["打不开", "连不上", "不显示", "不刷新", "没有", "失败", "报错", "异常"] },
  { label: "设备接入", terms: ["接入", "连接", "协议", "适配器", "上报"] },
  { label: "操作指引", terms: ["怎么", "如何", "怎样", "步骤", "使用", "设置", "创建", "查看"] },
  { label: "安全与验收", terms: ["安全", "急停", "验收", "控制", "审批", "测试"] },
];

const normalize = (value) => value.toLowerCase().replace(/\s+/g, "");
const contains = (source, term) => source.includes(normalize(term));

function scoreTopic(topic, normalizedQuestion) {
  return topic.keywords.reduce((score, keyword) => {
    if (!contains(normalizedQuestion, keyword)) return score;
    return score + (normalize(keyword).length >= 4 ? 4 : 2);
  }, 0);
}

function firstTopicMatch(topic, normalizedQuestion) {
  return Math.min(...topic.keywords.map((keyword) => normalizedQuestion.indexOf(normalize(keyword))).filter((index) => index >= 0));
}

export const supportSuggestedQuestions = [
  "无人机如何接入？",
  "电子围栏怎么设置？",
  "三维地图怎样拖动？",
  "告警出现后怎么处理？",
  "传感器数据不刷新怎么办？",
];

export function resolveSupportQuestion(rawQuestion) {
  const question = rawQuestion.trim();
  const normalizedQuestion = normalize(question);
  const topicScores = supportTopics
    .map((topic) => ({ topic, score: scoreTopic(topic, normalizedQuestion), firstMatch: firstTopicMatch(topic, normalizedQuestion) }))
    .filter(({ score }) => score > 0);
  const topScore = Math.max(0, ...topicScores.map(({ score }) => score));
  const multiIntent = /[，、；;]/.test(question) || (question.match(/[？?]/g) || []).length > 1 || topicScores.filter(({ score }) => score >= 4).length > 1;
  topicScores.sort((left, right) => multiIntent ? left.firstMatch - right.firstMatch : right.score - left.score);
  const selected = topicScores
    .filter(({ score }) => score >= (multiIntent ? 2 : Math.max(2, topScore - 2)))
    .slice(0, multiIntent ? 3 : 2)
    .map(({ topic }) => topic);
  const keywords = keywordGroups
    .filter((group) => group.terms.some((term) => contains(normalizedQuestion, term)))
    .map((group) => group.label)
    .slice(0, 7);
  const intentLabels = questionTypes
    .filter((type) => type.terms.some((term) => contains(normalizedQuestion, term)))
    .map((type) => type.label)
    .slice(0, 2);

  if (!selected.length) {
    return {
      title: "需要更具体的使用场景",
      keywords: intentLabels.length ? intentLabels : ["系统使用咨询"],
      intentLabel: intentLabels.join(" · ") || "使用指引",
      topics: [],
      fallback: true,
      lines: ["我已识别到您在咨询系统使用，但还缺少具体功能对象。", "可直接说明设备、功能和目标，例如：无人船 MQTT 接入、电子围栏设置、告警处置、地图拖动或传感器不刷新。"],
      related: supportSuggestedQuestions,
    };
  }

  const identified = keywords.length ? keywords : selected.map((topic) => topic.title).slice(0, 4);
  const confidence = topScore >= 6 ? "高" : "中";
  return {
    title: selected.length > 1 ? "多问题专业指引" : selected[0].title,
    keywords: identified,
    intentLabel: intentLabels.join(" · ") || "功能使用指引",
    confidence,
    topics: selected,
    fallback: false,
    lines: [selected.length > 1 ? `已拆分为 ${selected.length} 个使用问题，并按优先级逐项说明。` : "已根据功能、设备和操作关键词匹配对应使用步骤。"],
    related: [...new Set(selected.flatMap((topic) => topic.related))].slice(0, 3),
  };
}

export { supportTopics };
