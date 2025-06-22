const mangayomiSources = [{
    "name": "AniCrush (ENG SUB)",
    "id": "781484039",
    "baseUrl": "https://anicrush.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/logo.png",
    "isNsfw": false,
    "sourceCodeLanguage": 1,
    "itemType": 1,
    "version": "1.0.0",
    "apiUrl": "https://ac-api.ofchaos.com",
    "additionalParams": "sub"
}, {
    "name": "AniCrush (ENG DUB)",
    "id": "781484040",
    "baseUrl": "https://anicrush.to",
    "lang": "en",
    "typeSource": "single",
    "iconUrl": "https://raw.githubusercontent.com/ShadeOfChaos/Sora-Modules/refs/heads/main/AniCrush/logo.png",
    "isNsfw": false,
    "sourceCodeLanguage": 1,
    "itemType": 1,
    "version": "1.0.0",
    "apiUrl": "https://ac-api.ofchaos.com",
    "additionalParams": "dub"
}];

class DefaultExtension extends MProvider {

    constructor(source) {
        super(source);
        this.client = new Client();
    }

    // A helper to make API requests
    async apiRequest(url) {
        const res = await this.client.get(url);
        return JSON.parse(res.body);
    }

    // Maps the API status to the app's status code
    parseStatus(apiStatus) {
        switch (apiStatus) {
            case "RELEASING":
                return 0; // Ongoing
            case "FINISHED":
                return 1; // Completed
            case "NOT_YET_RELEASED":
                return 3; // Not yet aired
            default:
                return 5; // Unknown
        }
    }

    // --- Core Methods ---

    async getPopular(page) {
        // The original extension doesn't have a dedicated popular endpoint,
        // so we'll use the search function to get trending anime.
        return this.search("trending", page, []);
    }

    async getLatestUpdates(page) {
        // Similarly, we can use search to find recently updated anime.
        return this.search("recent", page, []);
    }

    async search(query, page, filters) {
        const searchUrl = `${this.source.apiUrl}/api/anime/search?keyword=${query}&page=${page}`;
        const data = await this.apiRequest(searchUrl);

        const animeList = (data.results || []).map(item => ({
            name: item.title.english || item.title.romaji,
            imageUrl: item.image,
            link: item.id // Pass the anime ID to getDetail
        }));

        const hasNextPage = data.meta?.hasNextPage || false;
        return {
            list: animeList,
            hasNextPage: hasNextPage
        };
    }

    async getDetail(url) {
        // The 'url' is the anime ID from the search/popular list
        const detailUrl = `${this.source.apiUrl}/api/anime/detail?id=${url}`;
        const data = await this.apiRequest(detailUrl);

        const anime = {
            name: data.title.english || data.title.romaji,
            imageUrl: data.image,
            description: data.description?.replace(/<[^>]*>?/gm, ''), // Remove HTML tags
            genre: data.genres,
            status: this.parseStatus(data.status),
            author: (data.studios || []).join(", ")
        };

        const type = this.source.additionalParams; // 'sub' or 'dub'

        const episodes = (data.episodes || [])
            .filter(ep => ep.type === type)
            .map(ep => ({
                name: `Episode ${ep.number}`,
                url: ep.id, // Pass the episode ID to getVideoList
                scanlator: ep.title,
                dateUpload: new Date(ep.airedAt).getTime().toString()
            }));

        anime.chapters = episodes;
        return anime;
    }

    async getVideoList(url) {
        // The 'url' is the episode ID from getDetail
        const streamUrl = `${this.source.apiUrl}/api/stream/watch?episodeId=${url}`;
        const data = await this.apiRequest(streamUrl);

        if (!data.sources || data.sources.length === 0) {
            return [];
        }

        const videos = [];
        data.sources.forEach(source => {
            if (source.quality === 'default' || source.quality === 'backup') {
                videos.push({
                    url: source.url,
                    originalUrl: source.url,
                    quality: "Default"
                });
            } else {
                 videos.push({
                    url: source.url,
                    originalUrl: source.url,
                    quality: source.quality
                });
            }
        });

        const subtitles = (data.subtitles || [])
            .filter(sub => sub.lang.toLowerCase().includes('english'))
            .map(sub => ({
                label: sub.lang,
                file: sub.url
            }));

        // Attach subtitles to all video streams
        videos.forEach(video => video.subtitles = subtitles);

        return videos;
    }
}
