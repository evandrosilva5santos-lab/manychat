import { describe, expect, it } from "vitest";
import { isVideoUrl, pickThumbnailUrl } from "./PostThumbnail";

const MP4 = "https://scontent.cdninstagram.com/o1/v/t16/f2/m86/video.mp4?_nc_ht=x&oh=abc";
const JPG = "https://scontent.cdninstagram.com/v/t51.2885-15/foto.jpg?stp=dst-jpg&oh=abc";
const THUMB = "https://scontent.cdninstagram.com/v/t51.2885-15/capa.jpg?oh=abc";

describe("miniatura de publicação", () => {
  it("reconhece arquivo de vídeo pela extensão, mesmo com query string", () => {
    expect(isVideoUrl(MP4)).toBe(true);
    expect(isVideoUrl(JPG)).toBe(false);
    expect(isVideoUrl("")).toBe(false);
    expect(isVideoUrl("não é url")).toBe(false);
  });

  it("Reels usa a capa (thumbnail_url), nunca o .mp4 — antes a imagem quebrava", () => {
    expect(pickThumbnailUrl({ mediaType: "VIDEO", mediaUrl: MP4, thumbnailUrl: THUMB })).toBe(THUMB);
    expect(pickThumbnailUrl({ mediaType: "VIDEO", mediaUrl: MP4 })).toBe("");
  });

  it("foto e carrossel usam a própria imagem", () => {
    expect(pickThumbnailUrl({ mediaType: "IMAGE", mediaUrl: JPG })).toBe(JPG);
    expect(pickThumbnailUrl({ mediaType: "CAROUSEL_ALBUM", mediaUrl: JPG })).toBe(JPG);
  });
});
