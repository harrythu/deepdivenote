import Dm20151123, * as $Dm20151123 from '@alicloud/dm20151123'
import * as $OpenApi from '@alicloud/openapi-client'
import * as $Util from '@alicloud/tea-util'

function createClient(): Dm20151123 {
  const config = new $OpenApi.Config({
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  })
  config.endpoint = 'dm.aliyuncs.com'
  return new Dm20151123(config)
}

export async function sendEmail({
  to,
  subject,
  htmlBody,
}: {
  to: string
  subject: string
  htmlBody: string
}): Promise<void> {
  const client = createClient()
  const fromAddress = process.env.ALIYUN_DM_FROM_ADDRESS
  if (!fromAddress) {
    throw new Error('ALIYUN_DM_FROM_ADDRESS 环境变量未设置')
  }

  const request = new $Dm20151123.SingleSendMailRequest({
    accountName: fromAddress,
    addressType: 1,
    replyToAddress: false,
    toAddress: to,
    subject,
    htmlBody,
  })

  const runtime = new $Util.RuntimeOptions({})
  await client.singleSendMailWithOptions(request, runtime)
}

export function buildPasswordResetEmail(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>重置密码</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">DeepDiveNote</h1>
              <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">AI 会议录音转写系统</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;font-weight:600;">重置您的密码</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                我们收到了您的密码重置请求。请点击下方按钮设置新密码。
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:6px;background-color:#2563eb;">
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
                      重置密码
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#64748b;font-size:13px;">
                或复制以下链接到浏览器：
              </p>
              <p style="margin:0 0 24px;color:#2563eb;font-size:13px;word-break:break-all;">
                ${resetUrl}
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                此链接将在 <strong>15 分钟</strong>后失效，且只能使用一次。<br>
                如果您没有请求重置密码，请忽略此邮件，您的账户不会受到任何影响。
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                © 2024 DeepDiveNote · 此邮件由系统自动发送，请勿回复
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
