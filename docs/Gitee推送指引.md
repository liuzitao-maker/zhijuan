# Gitee 推送指引

> 比赛接受 GitHub 或 Gitee 的 **Public** 仓库。本机实测 gitee.com 的 git over HTTPS 通道正常。

## 一、先在 Gitee 建一个空仓库（2 分钟）

1. 打开 https://gitee.com ，注册 / 登录（手机号即可）
2. 右上角「+」→「新建仓库」
3. 填写：
   - **仓库名称**：`zhijuan`
   - **仓库介绍**：智卷 · AI 智能出卷与批改引擎（传智杯 AI 创新应用挑战赛参赛作品）
   - **是否开源**：**公开**（必须 Public）
   - 初始化仓库：**全部不勾选**（不要 README、不要 .gitignore、不要开源许可证）
4. 点击「创建」

## 二、推送代码（在项目目录执行）

```powershell
cd "C:\Users\刘子韬\Documents\deepseek-harness\default-workspace\zhijuan"

git remote remove origin 2>$null
git remote add origin https://gitee.com/<你的Gitee用户名>/zhijuan.git
git push -u origin main
```

> 第一次推送会要求输入 Gitee 账号密码。
> **注意**：Gitee 现在要求用「私人令牌」代替密码：
> 头像 →「设置」→「私人令牌」→「生成新令牌」→ 勾选 `projects` 权限 → 复制令牌，
> 在密码输入处粘贴令牌。

## 三、验证

浏览器打开 `https://gitee.com/<你的Gitee用户名>/zhijuan`，确认：

- [ ] 仓库是 **公开** 的（退出登录后仍能访问）
- [ ] 首页能看到 README 渲染结果
- [ ] 提交历史 ≥ 25 条（点「提交」查看）
- [ ] 文件树里**没有** `.env` 文件（Key 不会泄露）

## 四、可选：把仓库地址写进 README

如果仓库地址与默认不同，可执行：

```powershell
git add README.md
git commit -m "docs: 补充仓库地址"
git push
```

## 五、兜底方案（如果 Gitee 也推送失败）

直接打包源码提交网盘：

```powershell
cd "C:\Users\刘子韬\Documents\deepseek-harness\default-workspace"
git -C zhijuan bundle create zhijuan.bundle --all
Compress-Archive -Path zhijuan -DestinationPath zhijuan-源码.zip -Force
```

> `zhijuan.bundle` 包含完整提交历史，可在任意机器上 `git clone zhijuan.bundle` 还原。
> 但比赛明确要求公开仓库链接，所以**优先解决推送**，打包只作为时间不够时的兜底。
