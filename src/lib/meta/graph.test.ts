import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRAPH_API_BASE, GRAPH_API_VERSION, InstagramGraphClient, graphBaseFor } from "./graph";
const fetchMock = vi.fn();
const client = new InstagramGraphClient("test-token");
const respond = (body: unknown, status = 200) => fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); });
afterEach(() => vi.unstubAllGlobals());
describe("Instagram Login Graph client", () => {
  it("fails honestly without credentials", async () => { expect(await new InstagramGraphClient(null).sendTextMessage("u", "oi")).toMatchObject({success:false,retryable:false}); expect(fetchMock).not.toHaveBeenCalled(); });
  it("sends private reply without IGSID and uses bearer, timeout, no cache", async () => {
    respond({message_id:"m",recipient_id:"u"});
    expect(await client.sendTextMessage("u", "oi", {commentId:"c"})).toMatchObject({success:true,messageId:"m"});
    const [url, init] = fetchMock.mock.calls[0]; expect(url).toBe(`${GRAPH_API_BASE}/me/messages`); expect(init.headers.Authorization).toBe("Bearer test-token"); expect(init.signal).toBeInstanceOf(AbortSignal); expect(init.cache).toBe("no-store"); expect(JSON.parse(init.body)).toEqual({recipient:{comment_id:"c"},message:{text:"oi"}});
  });
  it("uses recipient id for ordinary messages", async () => { respond({message_id:"m"}); await client.sendTextMessage("u","oi"); expect(JSON.parse(fetchMock.mock.calls[0][1].body).recipient).toEqual({id:"u"}); });
  it("validates bytes instead of slicing unicode text", async () => { expect((await client.sendTextMessage("u","😀".repeat(251))).success).toBe(false); expect(fetchMock).not.toHaveBeenCalled(); respond({message_id:"m"}); expect((await client.sendTextMessage("u","😀".repeat(250))).success).toBe(true); });
  it("enforces button count/title/text limits", async () => {
    const button = {type:"postback" as const,title:"Abrir",payload:"p"};
    for (const [text,buttons] of [["oi",[]],["x".repeat(641),[button]],["oi",Array(4).fill(button)],["oi",[{...button,title:"x".repeat(21)}]]] as const) expect((await client.sendButtonMessage("u",text,[...buttons])).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled(); respond({message_id:"m"}); await client.sendButtonMessage("u","oi",[button],{commentId:"c"}); expect(JSON.parse(fetchMock.mock.calls[0][1].body).message.attachment.payload).toEqual({template_type:"button",text:"oi",buttons:[button]});
  });
  it("enforces carousel limits and sends generic payload", async () => {
    const card = {title:"Card",imageUrl:"https://example.com/a.jpg",buttonTitle:"Abrir",buttonType:"web_url" as const,url:"https://example.com"};
    expect((await client.sendCarouselMessage("u",[])).success).toBe(false); expect((await client.sendCarouselMessage("u",Array(11).fill(card))).success).toBe(false);
    respond({message_id:"m"}); await client.sendCarouselMessage("u",[card]); expect(JSON.parse(fetchMock.mock.calls[0][1].body).message.attachment.payload.template_type).toBe("generic");
  });
  it("subscribes postbacks and requires an explicit success response", async () => { respond({success:true}); expect((await client.subscribeWebhooks("u")).success).toBe(true); expect(fetchMock.mock.calls[0][0]).toBe(`${GRAPH_API_BASE}/me/subscribed_apps`); expect(JSON.parse(fetchMock.mock.calls[0][1].body).subscribed_fields).toContain("messaging_postbacks"); respond({success:false}); expect((await client.subscribeWebhooks()).success).toBe(false); });
  it("loads Instagram identity without Facebook page fields", async () => { respond({user_id:"u",username:"user"}); expect(await client.validateConnection()).toMatchObject({valid:true,igUserId:"u",username:"user"}); expect(fetchMock.mock.calls[0][0]).toContain("user_id%2Cusername"); });
  it("replies publicly", async () => { respond({id:"reply"}); expect(await client.replyToComment("c","oi")).toMatchObject({success:true,id:"reply"}); expect(fetchMock.mock.calls[0][0]).toBe(`${GRAPH_API_BASE}/c/replies`); });
  it.each([190,10,2018278,2534022,4,613,32,100])("maps Meta code %s without raw error leakage", async code => { const expired = vi.fn(); respond({error:{code,error_subcode:123,message:"test-token secret"}},400); const result = await new InstagramGraphClient("test-token",expired).sendTextMessage("u","oi"); expect(result).toMatchObject({success:false,code,subcode:123,retryable:[4,613,32].includes(code)}); expect(result.error).not.toContain("test-token"); expect(expired).toHaveBeenCalledTimes(code===190?1:0); });
  it("rejects malformed success and non-JSON responses", async () => { respond({}); expect((await client.sendTextMessage("u","oi")).success).toBe(false); fetchMock.mockResolvedValue(new Response("<html>error</html>",{status:502})); expect(await client.sendTextMessage("u","oi")).toMatchObject({success:false,retryable:true}); });
  it("sanitizes network/timeout failures", async () => { fetchMock.mockRejectedValue(new Error("test-token")); expect(await client.sendTextMessage("u","oi")).toMatchObject({success:false,retryable:true}); });
  it("normalizes media and never falls back to demo records", async () => { respond({data:[{id:"m",media_type:"VIDEO",thumbnail_url:"https://example.com/a",like_count:4}]}); expect(await client.getUserMedia("u",10)).toMatchObject({success:true,data:[{id:"m",mediaType:"VIDEO",likeCount:4}]}); expect(fetchMock.mock.calls[0][0]).not.toContain("test-token"); respond({data:[{id:"m",media_type:"WRONG"}]}); expect(await client.getUserMedia()).toMatchObject({success:false,data:[]}); });
  it("does not treat a failed follow check as false", async () => { respond({error:{code:190}},400); await expect(client.checkUserFollows("u")).rejects.toThrow("Token expirado"); });
});
describe("Graph client por provedor de login", () => {
  const fb = new InstagramGraphClient("page-token", { provider: "facebook" });
  it("escolhe o host pelo provedor (Instagram por padrão)", () => { expect(graphBaseFor()).toBe(`https://graph.instagram.com/${GRAPH_API_VERSION}`); expect(graphBaseFor("facebook")).toBe(`https://graph.facebook.com/${GRAPH_API_VERSION}`); expect(GRAPH_API_BASE).toBe(graphBaseFor("instagram")); });
  it("conta do Facebook envia DM e resposta pública pelo graph.facebook.com", async () => { respond({message_id:"m"}); await fb.sendTextMessage("u","oi"); expect(fetchMock.mock.calls[0][0]).toBe(`${graphBaseFor("facebook")}/me/messages`); respond({id:"r"}); await fb.replyToComment("c","oi"); expect(fetchMock.mock.calls[1][0]).toBe(`${graphBaseFor("facebook")}/c/replies`); });
  it("mantém onExpired com provedor definido", async () => { const onExpired = vi.fn(); respond({error:{code:190}},400); await new InstagramGraphClient("t",{onExpired,provider:"facebook"}).sendTextMessage("u","oi"); expect(onExpired).toHaveBeenCalledTimes(1); });
  it("inscreve a Página nos campos do Messenger para Instagram", async () => { respond({success:true}); expect((await fb.subscribeWebhooks()).success).toBe(true); expect(fetchMock.mock.calls[0][0]).toBe(`${graphBaseFor("facebook")}/me/subscribed_apps`); expect(JSON.parse(fetchMock.mock.calls[0][1].body).subscribed_fields).toEqual(["messages","messaging_postbacks","feed"]); });
  it("valida a conexão do Facebook pela conta do Instagram vinculada à Página", async () => { respond({instagram_business_account:{id:"ig1",username:"loja",name:"Loja"}}); expect(await fb.validateConnection()).toMatchObject({valid:true,igUserId:"ig1",username:"loja"}); expect(fetchMock.mock.calls[0][0]).toContain("instagram_business_account"); });
  it("token de Página não é renovado e não chama a Meta", async () => { expect(await fb.refreshLongLivedToken()).toMatchObject({success:false,retryable:false}); expect(fetchMock).not.toHaveBeenCalled(); });
  it("token do Instagram continua renovando no endpoint sem versão", async () => { respond({access_token:"n",expires_in:5}); await client.refreshLongLivedToken(); expect(fetchMock.mock.calls[0][0]).toContain("https://graph.instagram.com/refresh_access_token"); });
});
