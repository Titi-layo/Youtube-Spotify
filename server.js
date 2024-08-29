const { getToken, addToPlaylist } = require("./utils.js");
const {
  YOUTUBE_TOKEN_URL,
  SPOTIFY_TOKEN_URL,
  YOUTUBE_SCOPE,
  PLAYLIST_NAME,
  SPOTIFY_SCOPE,
} = require("./config.js");
const PORT = process.env.PORT || 8000;

require("dotenv").config();

const express = require("express");
const path = require("path");
const fetch = require("node-fetch");
const app = express();
const getInfo = require("get-artist-title");

const likedDetails = [];
let uris = [];

app.use(express.static(path.join(__dirname, "public")));

app.get("/", function (req, res) {
  res.sendFile("/index.html");
});

app.get("/youtube-authorize", function (req, res) {
  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.youtubeClientId}&redirect_uri=${process.env.youtubeRedirectUri}&response_type=code&scope=${YOUTUBE_SCOPE}`
  );
});

app.get("/youtube-callback/", async (req, res) => {
  /**Get youtube token using code */
  const token = await getToken(
    YOUTUBE_TOKEN_URL,
    "authorization_code",
    process.env.youtubeClientId,
    process.env.youtubeClientSecret,
    req.query.code,
    process.env.youtubeRedirectUri
  );

  /**Get liked youtube videos */
  const resp = await fetch(
    "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=50",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token.access_token}` },
    }
  );

  const likedVideos = await resp.json();

  likedVideos.items.map((video) => {
    if (video.snippet.categoryId === "10") {
      let details = getInfo(video.snippet.title);

      if (details) {
        likedDetails.push({ artist: details[0], song: details[1] });
      }
    }
  });

  res.redirect(process.env.getSpotifyUris);
});

app.get("/getSpotifyUris/", async (req, res) => {
  const result = await getToken(
    SPOTIFY_TOKEN_URL,
    "client_credentials",
    process.env.clientId,
    process.env.clientSecret
  );

  const token = result.access_token;

  const uriPromise = likedDetails.map(async (details) => {
    const searchResponse = await fetch(
      `https://api.spotify.com/v1/search?q=track:${details.song}%20artist:${details.artist}&type=track`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!searchResponse.ok) {
      console.log("This is the searchResponse", searchResponse);
      const err = await searchResponse.json();
      console.log("This is the error", err);
    }

    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      console.log("This is the searchjson", searchResult);
      if (searchResult.tracks.items.length !== 0) {
        return searchResult.tracks.items[0].uri;
        //   uris.push(vals.tracks.items[0].uri);
      }
    }
  });

  uris = await Promise.all(uriPromise);

  console.log("These are the uris", uris);
  res.redirect(
    `https://accounts.spotify.com/authorize?client_id=${process.env.clientId}&response_type=code&redirect_uri=${process.env.spotifyAuth}&scope=${SPOTIFY_SCOPE}`
  );
});

app.get("/spotify-callback", async (req, res) => {
  const token = await getToken(
    SPOTIFY_TOKEN_URL,
    "authorization_code",
    process.env.clientId,
    process.env.clientSecret,
    req.query.code,
    process.env.spotifyAuth
  );

  let resp;
  resp = await fetch("https://api.spotify.com/v1/me/playlists", {
    method: "GET",
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  const playlists = await resp.json();

  const existingPlaylist = playlists.items.find(
    (playlist) => playlist.name === PLAYLIST_NAME
  );

  if (existingPlaylist) {
    const playlist = await fetch(
      `https://api.spotify.com/v1/playlists/${existingPlaylist.id}/tracks`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token.access_token}` },
      }
    );

    const resp = await playlist.json();
    const playlistItems = resp.items;
    const playlistURIs = [];
    const tobeAdded = [];

    playlistItems.map((song) => {
      playlistURIs.push(song.track.uri);
    });

    uris.map((uri) => {
      if (!playlistURIs.includes(uri)) {
        tobeAdded.push(uri);
      }
    });

    console.log("These are to be added", tobeAdded);

    if (tobeAdded.length !== 0) {
      const output = await addToPlaylist(
        existingPlaylist.id,
        token.access_token,
        tobeAdded
      );
      console.log(JSON.stringify(output));
    } else {
      console.log("Your youtube likes playlist is up to date!!!");
    }
  } else {
    resp = await fetch("https://api.spotify.com/v1/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    const userId = await resp.json();

    const playlist = await fetch(
      `https://api.spotify.com/v1/users/${userId.id}/playlists`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.access_token}` },
        body: JSON.stringify({ name: "Youtube Likes" }),
      }
    );

    const newPlaylist = await playlist.json();

    resp = await fetch(
      `https://api.spotify.com/v1/playlists/${newPlaylist.id}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          // 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ uris: uris }),
      }
    );
  }

  res.redirect(process.env.end);

  //   createPlaylist().then(() => {
  //     res.redirect(process.env.end);
  //   });
});

app.get("/end", function (req, res) {
  res.send("You reached the end :)");
});

app.listen(PORT);
