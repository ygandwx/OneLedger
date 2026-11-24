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

## 报表、汇率和备份

在「汇率」中获取行情或录入手动报价，再到「报表」选择交易期间、主体、币种及分组，导出当前筛选的 CSV。汇率来源为 [Frankfurter v2](https://frankfurter.dev/)。FX_CRON、BACKUP_CRON、REMINDER_CRON 均采用 TZ 时区，修改 .env 后运行 `docker compose up -d --force-recreate app`。

每天默认 03:30 执行 SQLite `VACUUM INTO`，归档数据库快照和 uploads 到 /data/backups，成功后保留最近 30 份。应定期将压缩包另存到 VPS 以外的位置。以下命令列出备份并复制一份到宿主机；把示例文件名替换为实际文件名。

```sh
docker compose exec app ls -lh /data/backups
docker compose cp app:/data/backups/oneledger-实际时间.tar.gz ./restore.tar.gz
```

### 从备份恢复

在含有效 .env 的仓库目录操作。以下命令适用于默认数据库路径 /data/ledger.db。先检查归档，再停掉 app。下面的命令先在临时目录解包并检查文件，再把现有数据库、WAL 和附件移到 before-restore 目录。保留该目录直至恢复验证完成。

```sh
tar -tzf restore.tar.gz
docker compose stop app
docker compose run --rm -T --no-deps app sh -ec '
  cd /data
  staged=$(mktemp -d /data/restore-staging-XXXXXX)
  tar -xzf - -C "$staged"
  test -s "$staged/ledger.db"
  test -d "$staged/uploads"
  previous=$(mktemp -d /data/before-restore-XXXXXX)
  for item in ledger.db ledger.db-wal ledger.db-shm uploads; do
    if [ -e "$item" ]; then mv "$item" "$previous/"; fi
  done
  mv "$staged/ledger.db" "$staged/uploads" /data/
  rmdir "$staged"
' < ./restore.tar.gz
docker compose up -d app
```

恢复后用备份时的账号及 TOTP 登录，核对一笔交易并下载其附件。若需回退，先停止 app，再将恢复出的数据库、WAL 和 uploads 移出数据目录，将 before-restore 目录中原有的文件移回原位。

## 周期事项与提醒

在「周期事项」新建订阅或年度事项，选择提醒天数（例如 7,1）。到期当天也会提醒；每日任务按原定日推算下期，小月取月末。启用自动生成后，待确认扣款会显示在首页。只提醒的事项可在列表中手动完成本期。

站内通知可在「设置与通知」查看。若启用 Telegram，先在 Telegram 中向自己的机器人发起对话，设置 TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID，重新创建 app 服务后使用设置页的测试按钮。每日消息按业务日期合并，发送失败将在下次运行重试。

## 公司档案与附件

「公司档案」保存注册、地址、财年及董事股东资料。可从公司档案、周期事项或支出记录进入关联文件；录入支出时可选「保存并添加附件」。每个附件最多 25 MiB，保存在 /data/uploads，通过登录后的预览或下载链接访问。生产部署请妥善保管 .env、数据卷及备份，备份内包含账号的 TOTP 密钥和财务资料。

## 运行测试

`npm test` 覆盖金额最小单位、汇率回退及交叉换算、月末与闰年、还款跨月、报表净额和垫付口径。
