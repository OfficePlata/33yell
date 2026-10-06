// Lark Open API（BASE・メッセージ）を Workers から呼ぶ薄いラッパー。

export const TABLES = {
  members: "メンバー",
  rounds: "集金回",
  dues: "入金",
  imports: "照合ログ",
};

export class Lark {
  constructor(env) {
    this.env = env;
    this.domain = env.LARK_DOMAIN || "open.larksuite.com";
    this.base = env.LARK_BASE_TOKEN;
    this.token = null;
    this.tableIds = null;
  }

  async tenantToken() {
    if (this.token && this.token.exp > Date.now()) return this.token.value;
    const res = await fetch(`https://${this.domain}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: this.env.LARK_APP_ID, app_secret: this.env.LARK_APP_SECRET }),
    });
    const json = await res.json();
    if (json.code !== 0) throw new Error(`Lark token: ${json.msg}`);
    this.token = { value: json.tenant_access_token, exp: Date.now() + (json.expire - 60) * 1000 };
    return this.token.value;
  }

  async api(method, path, body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`https://${this.domain}${path}`, {
        method,
        headers: { Authorization: `Bearer ${await this.tenantToken()}`, "Content-Type": "application/json; charset=utf-8" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      const json = await res.json();
      if (json.code !== 0) throw new Error(`Lark ${method} ${path}: ${json.code} ${json.msg}`);
      return json.data;
    }
    throw new Error(`Lark ${method} ${path}: rate limited`);
  }

  async tableId(key) {
    if (!this.tableIds) {
      const data = await this.api("GET", `/open-apis/bitable/v1/apps/${this.base}/tables?page_size=100`);
      this.tableIds = Object.fromEntries(data.items.map((t) => [t.name, t.table_id]));
    }
    const id = this.tableIds[TABLES[key]];
    if (!id) throw new Error(`テーブル「${TABLES[key]}」が BASE にありません`);
    return id;
  }

  /** conditions: [[フィールド名, 値], ...]（すべて「等しい」で AND） */
  async records(key, conditions = []) {
    const table = await this.tableId(key);
    const body = {};
    if (conditions.length) {
      body.filter = {
        conjunction: "and",
        conditions: conditions.map(([field_name, value]) => ({ field_name, operator: "is", value: [String(value)] })),
      };
    }
    const out = [];
    let pageToken = "";
    do {
      const q = `page_size=500${pageToken ? `&page_token=${pageToken}` : ""}`;
      const data = await this.api("POST", `/open-apis/bitable/v1/apps/${this.base}/tables/${table}/records/search?${q}`, body);
      for (const item of data.items || []) out.push({ id: item.record_id, ...normalize(item.fields) });
      pageToken = data.has_more ? data.page_token : "";
    } while (pageToken);
    return out;
  }

  async create(key, rows) {
    const table = await this.tableId(key);
    for (let i = 0; i < rows.length; i += 500) {
      await this.api("POST", `/open-apis/bitable/v1/apps/${this.base}/tables/${table}/records/batch_create`, {
        records: rows.slice(i, i + 500).map((fields) => ({ fields })),
      });
    }
  }

  async update(key, recordId, fields) {
    const table = await this.tableId(key);
    await this.api("PUT", `/open-apis/bitable/v1/apps/${this.base}/tables/${table}/records/${recordId}`, { fields });
  }

  /** ボタン1つのカードを送る。receiveIdType: open_id / chat_id */
  async sendCard(receiveIdType, receiveId, { title, text, buttonText, url }) {
    const card = {
      config: { wide_screen_mode: true },
      header: { template: "yellow", title: { tag: "plain_text", content: title } },
      elements: [
        { tag: "div", text: { tag: "lark_md", content: text } },
        ...(url ? [{ tag: "action", actions: [{ tag: "button", type: "primary", text: { tag: "plain_text", content: buttonText }, url }] }] : []),
      ],
    };
    await this.api("POST", `/open-apis/im/v1/messages?receive_id_type=${receiveIdType}`, {
      receive_id: receiveId,
      msg_type: "interactive",
      content: JSON.stringify(card),
    });
  }
}

/** BASE の値（テキストは配列で返ることがある）を素直な値にそろえる */
export function normalize(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (Array.isArray(v) && v.every((x) => x && typeof x === "object" && "text" in x)) out[k] = v.map((x) => x.text).join("");
    else out[k] = v;
  }
  return out;
}
