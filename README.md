# 共和新路街道停车联盟小程序

## 项目说明

`Paking-app` 是停车联盟 C 端微信原生小程序，用于停车场查询、车位搜索、地图导航、共享申请、通知查看、登录注册和个人中心等功能。

## 技术栈

| 类别 | 说明 |
|------|------|
| 小程序类型 | 微信原生小程序 |
| 语言 | JavaScript / WXML / WXSS / WXS |
| 构建运行 | 微信开发者工具 |
| 基础库版本 | 3.3.5 |
| 地图能力 | 微信位置 API、高德 Web 服务 |
| 后端接口 | `/app/api/v1` |

## 目录结构

```text
Paking-app/
├── app.js                  # 应用入口，维护登录状态、token 刷新、接口基址和全局数据
├── app.json                # 页面、窗口、权限、tabBar 和懒加载配置
├── app.wxss                # 全局样式
├── project.config.json     # 微信开发者工具项目配置
├── sitemap.json            # 小程序索引配置
├── components/             # 自定义组件
│   └── navbar/             # 顶部导航栏组件
├── images/                 # 图片和停车场地图资源
├── pages/                  # 页面目录
│   ├── index/              # 首页
│   ├── login/              # 登录
│   ├── register/           # 注册
│   ├── forgetPassword/     # 忘记密码
│   ├── verifyCode/         # 验证码
│   ├── parking/            # 停车操作
│   ├── ai/                 # 小新页面
│   ├── search/             # 找车位
│   ├── mine/               # 我的
│   ├── shareApply/         # 共享申请
│   ├── parkingDetail/      # 停车场详情
│   ├── parkingMap/         # 停车场地图
│   ├── navi/               # 导航
│   ├── notice/             # 通知列表
│   └── noticeDetail/       # 通知详情
└── utils/                  # 工具函数
    ├── api.js              # 后端接口请求封装
    ├── amap.js             # 高德地图 Web 服务封装
    └── util.js             # 通用工具函数
```

> 目录中还保留 `about`、`car`、`coupon`、`favorite`、`help`、`record` 等页面文件；是否作为有效页面以 `app.json` 的 `pages` 配置为准。

## 运行方式

1. 打开微信开发者工具。
2. 导入 `Paking-app` 目录。
3. 按需确认 `project.config.json` 中的 `appid`、基础库版本和上传配置。
4. 确认后端服务可访问。
5. 编译运行小程序。

## 接口与环境

接口基址在 `app.js` 的 `getBaseUrl()` 中维护：

| 运行环境 | 默认接口基址 |
|----------|--------------|
| 微信开发者工具 | `http://127.0.0.1:7003/app/api/v1` |
| 真机/非开发者工具 | `http://127.0.0.1:7003/app/api/v1` |

如果本机后端端口、网络地址或代理方式变化，需要同步调整 `app.js`。

## 资源与上传包配置

`project.config.json` 的 `packOptions.ignore` 当前排除了以下较大资源：

- `images/parking-map.pdf`
- `images/parking-map-hd.png`
- `images/parking-map-ultra.png`
- `images/parking-map-ultra.jpg`
- `images/parking-map-4500.png`
- `images/parking-map-4200.png`
- `images/parking-map-tiles/`

上传前需要确认这些资源是否由线上地址、后端接口或其他方式提供，避免小程序包内资源缺失。

## 功能列表

- [x] 首页：地图展示、附近停车场列表
- [x] 找车位：搜索、筛选、排序
- [x] 小新：智能助手入口
- [x] 停车场详情：信息展示、地图查看、导航
- [x] 停车场地图：地图资源展示
- [x] 导航：路线规划、位置选择
- [x] 停车：扫码停车、结束停车
- [x] 登录注册：登录、注册、忘记密码、验证码
- [x] 共享申请：停车资源共享申请
- [x] 通知：通知列表和详情
- [x] 我的：个人信息入口

## 注意事项

1. 这是微信原生小程序，不需要 npm 安装。
2. 地图和导航功能需要用户授权位置权限，`app.json` 已声明 `getLocation` 和 `chooseLocation`。
3. 登录态、token 和用户信息使用微信本地缓存维护。
4. 修改页面路由时，以 `app.json` 为准同步页面目录和 tabBar 配置。
5. 上传或预览前，需要核对 `project.config.json` 的 `appid`、包体排除配置和接口地址。
