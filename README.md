# OneLedger

单人自用的个人与公司财务账本。界面使用简体中文，首次登录需设置密码和 TOTP 验证器。

## VPS 部署

准备带 Docker Compose 的 Linux VPS，把域名的 DNS 指向该主机，开放 80 和 443 端口。在新的空目录中运行：

```sh
git clone https://github.com/ygandwx/OneLedger.git
cd OneLedger
cp .env.example .env
openssl rand -hex 32
```

将生成的随机值填入 .env 的 SETUP_TOKEN，并设置 DOMAIN。运行 `docker compose up -d --build`，通过 HTTPS 打开域名，使用初始化口令创建账号并设置验证器。账号创建后初始化页自动关闭。Caddy 负责签发和续签证书。应用仅在 Compose 内部网络监听。数据库、上传文件和备份使用持久卷 ledger_data。

## 本地开发

使用 Node.js 24。复制 .env.example 为 .env，将 DATABASE_URL 改为 file:/绝对路径/data/ledger.db，DATA_DIR 改为同一绝对目录，手动创建该目录。仅本机 HTTP 调试时设 COOKIE_SECURE=false。填入 SETUP_TOKEN，再运行：

```sh
npm ci
npm run db:deploy
npm run dev
```

打开 http://localhost:3000。生产验证使用 `npm run build` 与 `npm start`。完整需求见 [docs/SPEC.md](docs/SPEC.md)，实现约定见 [docs/DECISIONS.md](docs/DECISIONS.md)。
