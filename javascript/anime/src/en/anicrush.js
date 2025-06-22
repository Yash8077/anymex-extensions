const mangayomiSources = [{
  name: "AniCrush (ENG SUB)",
  lang: "en",
  baseUrl: "https://anicrush.to",
  apiUrl: "",
  iconUrl: "https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/logo.png",
  typeSource: "single",
  itemType: 1,
  version: "2.2.1",
  pkgPath: "anime/src/en/anicrush.js"
}];

class AniCrush extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  async search(query, page = 1, filters) {
    const result = await this.areRequiredServersUp();
    if (!result.success) {
      return {
        list: [{
          name: result.searchTitle,
          link: '#' + result.error,
          imageUrl: 'https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png',
        }],
        hasNextPage: false,
      };
    }

    const resp = await this.client.get(`https://ac-api.ofchaos.com/api/anime/search?keyword=${encodeURIComponent(query)}&page=1&limit=24`);
    const data = JSON.parse(resp.body);

    if (!data?.status || !data?.result?.movies?.length) return { list: [], hasNextPage: false };

    const list = data.result.movies.map(movie => ({
      name: movie.name,
      imageUrl: this.getImage(movie.poster_path),
      link: `https://anicrush.to/watch/${movie.slug}.${movie.id}`
    }));

    return { list, hasNextPage: false };
  }

  getImage(path) {
    const base = "https://static.gniyonna.com/media/poster";
    const filename = path.split('/')[2];
    const extension = path.split('.').pop();
    const reversed = filename.split("").reverse().join("");
    return `${base}/300x400/100/${reversed}.${extension}`;
  }

  async getDetail(url) {
    if (url.startsWith("#")) {
      return {
        name: decodeURIComponent(url.slice(1)),
        chapters: [],
      };
    }

    const movieId = url.split('.').pop();
    const detailResp = await this.client.get(`https://ac-api.ofchaos.com/api/anime/info/${movieId}`);
    const detailData = JSON.parse(detailResp.body);

    const episodesResp = await this.client.get(`https://ac-api.ofchaos.com/api/anime/episodes?movieId=${movieId}`);
    const episodesData = JSON.parse(episodesResp.body);

    const chapters = [];
    for (const episodeList in episodesData.result) {
      for (const ep of episodesData.result[episodeList]) {
        chapters.push({
          name: `Episode ${ep.number}`,
          url: `https://api.anicrush.to/shared/v2/episode/sources?_movieId=${movieId}&ep=${ep.number}&sv=4&sc=sub`,
        });
      }
    }

    return {
      name: detailData.result?.name ?? "Unknown",
      description: detailData.result?.overview ?? "No description.",
      chapters,
    };
  }

  async getVideoList(url) {
    if (url.indexOf('?') === -1) return [];

    const params = Object.fromEntries(new URLSearchParams(url.split('?')[1]).entries());
    const { _movieId: id, ep: episode, sv: server = 4, sc: format = "sub" } = params;

    const serversResp = await this.client.get(`https://ac-api.ofchaos.com/api/anime/servers/${id}?episode=${episode}`);
    const serversData = JSON.parse(serversResp.body);

    const selected = serversData.result[format]?.find(s => s.server == server) ?? serversData.result[format]?.[0];

    const sourceResp = await this.client.get(`https://ac-api.ofchaos.com/api/anime/sources?movieId=${id}&episode=${episode}&server=${selected.server}&format=${format}`);
    const sourceData = JSON.parse(sourceResp.body);

    const embedUrl = sourceData.result.link;
    const embedResp = await this.client.get(`https://ac-api.ofchaos.com/api/anime/embed/convert/v2?embedUrl=${encodeURIComponent(embedUrl)}`);
    const embedData = JSON.parse(embedResp.body);

    const streamSources = embedData.result?.sources || [];
    const tracks = embedData.result?.tracks || [];

    const videoList = streamSources.map(src => ({
      url: src.file,
      quality: `AniCrush - ${src.label ?? src.type}`,
      originalUrl: src.file,
      subtitles: tracks.filter(t => t.kind === "captions" && t.label?.startsWith("English")).map(sub => ({
        file: sub.file,
        label: sub.label,
      })),
    }));

    return videoList;
  }

  async areRequiredServersUp() {
    const hosts = ['https://anicrush.to', 'https://ac-api.ofchaos.com'];
    const checks = await Promise.allSettled(
      hosts.map(async host => {
        const res = await this.client.get(host);
        return { host, ok: res.status === 200 };
      })
    );

    for (const check of checks) {
      if (check.status === 'rejected' || !check.value.ok) {
        const host = check.value?.host;
        const message = `Required source ${host} is currently down.`;
        return { success: false, error: encodeURIComponent(message), searchTitle: message };
      }
    }

    return { success: true };
  }

  // Unused but required methods for interface
  get supportsLatest() {
    return false;
  }

  async getLatestUpdates() {
    return { list: [], hasNextPage: false };
  }

  async getPageList(url) {
    return [];
  }

  getFilterList() {
    return [];
  }

  getSourcePreferences() {
    return [];
  }

  async getHtmlContent(url) {
    return "";
  }

  async cleanHtmlContent(html) {
    return html;
  }

  getHeaders(url) {
    return {};
  }

  async getPopular(page) {
    return { list: [], hasNextPage: false };
  }
}
