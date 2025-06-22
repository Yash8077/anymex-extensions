const mangayomiSources = [
  {
    "name": "AniCrush (ENG SUB)",
    "lang": "en",
    "id": 99082314,
    "baseUrl": "https://anicrush.to",
    "apiUrl": "",
    "iconUrl": "https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/logo.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "2.2.3",
    "pkgPath": "anime/src/en/anicrush.js"
  }
];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  getHeaders(url) {
    return {
      Referer: "https://anicrush.to",
      Origin: "https://anicrush.to"
    };
  }

  async areRequiredServersUp() {
    const hosts = ["https://anicrush.to", "https://ac-api.ofchaos.com"];
    const checks = await Promise.allSettled(
      hosts.map(async (host) => {
        const res = await this.client.get(host);
        return { host: host, ok: res.status === 200 };
      })
    );

    for (const check of checks) {
      if (check.status === "rejected" || !check.value.ok) {
        const host = check.value?.host;
        const message = `Required source ${host} is currently down.`;
        return {
          success: false,
          error: encodeURIComponent(message),
          searchTitle: message
        };
      }
    }

    return { success: true };
  }

  getImage(path) {
    const base = "https://static.gniyonna.com/media/poster";
    const filename = path.split("/")[2];
    const extension = path.split(".").pop();
    const reversed = filename.split("").reverse().join("");
    return `${base}/300x400/100/${reversed}.${extension}`;
  }

  async search(query, page = 1, filters) {
    const result = await this.areRequiredServersUp();
    if (!result.success) {
      return {
        list: [
          {
            name: result.searchTitle,
            imageUrl: "https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/sora_host_down.png",
            link: "#" + result.error
          }
        ],
        hasNextPage: false
      };
    }

    const resp = await this.client.get(
      `https://ac-api.ofchaos.com/api/anime/search?keyword=${encodeURIComponent(query)}`
    );
    const data = JSON.parse(resp.body);
    if (!data?.status || !data?.result?.movies?.length) return { list: [], hasNextPage: false };

    const list = data.result.movies.map((movie) => {
      return {
        name: movie.name,
        imageUrl: this.getImage(movie.poster_path),
        link: `https://anicrush.to/watch/${movie.slug}.${movie.id}`
      };
    });

    return { list, hasNextPage: false };
  }

  async getDetail(url) {
    if (url.startsWith("#")) {
      return {
        description: decodeURIComponent(url.slice(1)) + " Please try again later.",
        status: 5,
        genre: [],
        chapters: [],
        link: ""
      };
    }

    const movieId = url.split(".").pop();

    const detailResp = await this.client.get(`https://ac-api.ofchaos.com/api/anime/info/${movieId}`);
    const detailData = JSON.parse(detailResp.body);

    const episodesResp = await this.client.get(`https://ac-api.ofchaos.com/api/anime/episodes?movieId=${movieId}`);
    const episodesData = JSON.parse(episodesResp.body);

    const chapters = [];
    for (const episodeList in episodesData.result) {
      for (const ep of episodesData.result[episodeList]) {
        chapters.push({
          name: `Episode ${ep.number}`,
          url: `https://api.anicrush.to/shared/v2/episode/sources?_movieId=${movieId}&ep=${ep.number}&sv=4&sc=sub`
        });
      }
    }

    const genre = detailData.result?.genres ?? [];
    const statusText = detailData.result?.status ?? "Unknown";
    const status = statusText === "Completed" ? 1 : statusText === "Ongoing" ? 0 : 5;

    return {
      description: detailData.result?.overview ?? "No description.",
      status,
      genre,
      chapters,
      link: url
    };
  }

  async getVideoList(url) {
    if (url.indexOf("?") === -1) return [];

    const params = Object.fromEntries(new URLSearchParams(url.split("?")[1]).entries());
    const id = params["_movieId"];
    const episode = params["ep"];
    const server = params["sv"] ?? 4;
    const format = params["sc"] ?? "sub";

    const serversResp = await this.client.get(
      `https://ac-api.ofchaos.com/api/anime/servers/${id}?episode=${episode}`
    );
    const serversData = JSON.parse(serversResp.body);

    const selected = serversData.result[format]?.find((s) => s.server == server) ?? serversData.result[format]?.[0];

    const sourceResp = await this.client.get(
      `https://ac-api.ofchaos.com/api/anime/sources?movieId=${id}&episode=${episode}&server=${selected.server}&format=${format}`
    );
    const sourceData = JSON.parse(sourceResp.body);

    const embedUrl = sourceData.result.link;
    const embedResp = await this.client.get(
      `https://ac-api.ofchaos.com/api/anime/embed/convert/v2?embedUrl=${encodeURIComponent(embedUrl)}`
    );
    const embedData = JSON.parse(embedResp.body);

    const streamSources = embedData.result?.sources || [];
    const tracks = embedData.result?.tracks || [];

    const videoList = streamSources.map((src) => {
      return {
        url: src.file,
        originalUrl: src.file,
        quality: `AniCrush - ${src.label ?? src.type}`,
        headers: this.getHeaders(),
        subtitles: tracks
          .filter((t) => t.kind === "captions" && t.label?.startsWith("English"))
          .map((sub) => {
            return {
              file: sub.file,
              label: sub.label
            };
          })
      };
    });

    return videoList;
  }

  get supportsLatest() {
    return false;
  }

  async getLatestUpdates(page) {
    return { list: [], hasNextPage: false };
  }

  async getPopular(page) {
    return { list: [], hasNextPage: false };
  }

  getSourcePreferences() {
    return [];
  }

  async getPageList(url) {
    return [];
  }

  async getHtmlContent(url) {
    return "";
  }

  async cleanHtmlContent(html) {
    return html;
  }
} 
