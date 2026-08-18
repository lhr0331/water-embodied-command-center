# 设备实时接入与安全控制契约

浏览器只连接平台网关，不直接连接飞控、电机控制器、ROS 2 节点或 MQTT Broker。所有低层设备控制均由部署在现场专网中的边缘适配器执行。

## 运行模式

- `simulation`：默认模式。指令只更新演练状态，不会到达设备。
- `integration`：接收真实遥测，但仍拒绝真实控制指令。
- `live`：预留给经过认证的现场边缘执行适配器。当前代码库的标准网关会明确拒绝该模式，不能仅靠设置环境变量或网页按钮开启真实设备控制。

真实设备控制应由单独部署的边缘执行适配器实现：它必须完成设备身份认证、操作者权限、命令签名、审批令牌、电子围栏、急停、失联、低电量和控制器回执校验。这个能力不应在公开网络或开发电脑上启用。

## 统一遥测入口

`POST /api/v1/ingest/telemetry`

```json
{
  "deviceId": "UAV-D01",
  "type": "drone",
  "battery": 74.5,
  "linkQuality": 95,
  "speed": 13.1,
  "state": "飞行中",
  "location": "大坝东侧",
  "x": "70%",
  "y": "44%",
  "protocol": "mavlink",
  "sensors": {
    "flightAltitude": 118.4,
    "windSpeed": 5.8,
    "cameraTemp": 36.8
  }
}
```

`sensors` 为按设备类型扩展的标准化测点对象：无人机可用 `flightAltitude/windSpeed/cameraTemp`，无人船可用 `ph/turbidity/waterTemp`，轮式机器人可用 `cabinetTemp/vibration/gas`，机器狗可用 `slopeAngle/surfaceTemp/gas`。实际部署应额外保存 WGS-84 经纬度、高程、航向、时间戳、质量标记、原始协议帧 ID 和设备证书主体；`x/y` 仅用于当前演示地图定位。

## 电子围栏约束

网页端可在三维地图中绘制禁入、限高与水面作业区域。正式本机入口通过 `POST /api/v1/geofences` 写入网关，并持久化到 `data/operator-state.json`；生产接入时，还必须把经审批的围栏多边形、坐标参考系、有效期、高度上下限和版本号同步到飞控/船控/机器人安全控制器。浏览器绘制本身不能替代现场电子围栏或紧急停止。

## 告警入口

`POST /api/v1/ingest/alerts`

```json
{
  "level": "critical",
  "title": "溢洪道左侧边坡位移",
  "place": "K0+320",
  "confidence": "92%",
  "source": "vision-anomaly"
}
```

## 指令入口

`POST /api/v1/commands`

```json
{
  "action": "dispatch-inspection",
  "deviceIds": ["UAV-D01", "QGV-Q01"],
  "operator": "water-duty-01",
  "mode": "integration"
}
```

`simulation` 会更新演练状态。`integration` 会生成 `pending-field-approval` 的审计任务申请，不会改变设备执行状态。标准网关拒绝 `live`；后续经认证的边缘执行适配器还必须要求不可重放的 `approvalToken`、任务 ID、风险评估版本、电子围栏校验结果、设备健康状态和飞控/机器人控制器回执。

## 适配器映射

| 设备 | 上游协议 | 边缘适配器职责 |
|---|---|---|
| 无人机 | MAVLink 2 | 读取心跳、位置、电池、任务状态；将经批准任务转换为飞控可确认的命令。 |
| 无人船 | MQTT 5 | 订阅水质、测深与船况主题；控制主题必须走专用 ACL 和确认回执。 |
| 轮式机器人、机器狗 | ROS 2 | 从 ROS 2 话题规范化位姿、诊断、相机与急停健康状态；只从本地安全节点下发动作。 |

MAVLink 面向资源和带宽受限系统的遥测与命令模型适合无人机边缘适配器；MQTT 的发布/订阅机制适合设备遥测汇聚；ROS 2 负责机器人侧的本地运行时。生产上线时应锁定协议版本、证书、QoS、重连策略和告警审计要求。
