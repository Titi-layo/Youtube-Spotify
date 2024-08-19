const { getToken, getnewToken, addToPlaylist } = require("./utils.js");

const PORT = process.env.PORT || 8000;

require("dotenv").config();

const express = require("express");
const path = require("path");
const fetch = require("node-fetch");
const app = express();

const playlist_name = "Youtube Likes";
const getInfo = require("get-artist-title");
const spotify_token_url = `https://accounts.spotify.com/api/token`;
const youtube_token_url = `https://oauth2.googleapis.com/token`;
const response_type = `code`;
const youtube_scope = `https://www.googleapis.com/auth/youtube.readonly`;

const likedDetails = [];
let uris = [];

app.use(express.static(path.join(__dirname, "public")));

app.get("/", function (req, res) {
  res.sendFile("/index.html");
});

app.get("/login", function (req, res) {
  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YoutubeclientId}&redirect_uri=${process.env.YoutuberedirectUrl}&response_type=${response_type}&scope=${youtube_scope}`
  );
});

app.get("/authentication_tube/", function (req, res) {
  (async function getLikedvideos() {
    const token = await getToken(
      youtube_token_url,
      req.query.code,
      process.env.YoutuberedirectUrl,
      process.env.YoutubeclientId,
      process.env.YoutubeclientSecret
    );

    const resp = await fetch(
      "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=300",
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
  })();
});

app.get("/getSpotifyUris/", function (req, res) {
  (async function getURIs() {
    const result = await fetch(spotify_token_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=client_credentials&client_id=${process.env.clientId}&client_secret=${process.env.clientSecret}`,
    });

    const resp = await result.json();

    const token = resp.access_token;

    const uriPromise = likedDetails.map(async (details) => {
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=track:${details.song}%20artist:${details.artist}&type=track`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (searchResponse.status === 200) {
        const searchResult = await searchResponse.json();

        if (searchResult.tracks.items.length !== 0) {
          return searchResult.tracks.items[0].uri;
          //   uris.push(vals.tracks.items[0].uri);
        }
      }
    });

    uris = await Promise.all(uriPromise);

    res.redirect(
      `https://accounts.spotify.com/authorize?client_id=${process.env.clientId}&response_type=${response_type}&redirect_uri=${process.env.spotifyAuth}&scope=user-read-private%20playlist-modify-private%20user-read-email%20playlist-modify-public&state=34fFs29kd09`
    );
  })();
});

app.get("/authentication", function (req, res) {
  const getUserInfo = async () => {
    const token = await getToken(
      spotify_token_url,
      req.query.code,
      process.env.spotifyAuth,
      process.env.clientId,
      process.env.clientSecret
    );
    const resp = await fetch("https://api.spotify.com/v1/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token.access_token}` },
    });

    const userID = await resp.json();

    return { id: userID.id, refresh_token: token.refresh_token };
  };

  const checkPlaylist = async () => {
    const input = await getUserInfo();

    const result = await getnewToken(input.refresh_token);

    const resp = await fetch("https://api.spotify.com/v1/me/playlists", {
      method: "GET",
      headers: { Authorization: `Bearer ${result.access_token}` },
    });

    const playlists = await resp.json();

    let playlistExists = false;
    let playlistId;
    playlists.items.map((playlist) => {
      if (playlist.name === playlist_name) {
        playlistExists = true;
        playlistId = playlist.id;

        return;
      }
    });

    return {
      exists: playlistExists,
      refresh_token: input.refresh_token,
      id: input.id,
      playlistId,
    };
  };

  const createPlaylist = (async () => {
    const playlistCheck = await checkPlaylist();

    const { access_token: newAccessToken } = await getnewToken(
      playlistCheck.refresh_token
    );

    if (playlistCheck.exists === false) {
      const playlist = await fetch(
        `https://api.spotify.com/v1/users/${playlistCheck.id}/playlists`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${newAccessToken}` },
          body: JSON.stringify({ name: "Youtube Likes" }),
        }
      );

      const newPlaylist = await playlist.json();

      fetch(`https://api.spotify.com/v1/playlists/${newPlaylist.id}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
          // 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ uris: uris }),
      })
        .then((res) => res.json())
        .then((val) => console.log(val));
    } else {
      const playlist = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistCheck.playlistId}/tracks`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${newAccessToken}` },
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
        if (playlistURIs.includes(uri) === false) {
          tobeAdded.push(uri);
        }
      });

      if (tobeAdded.length !== 0) {
        const output = await addToPlaylist(
          playlistCheck.playlistId,
          newAccessToken,
          tobeAdded
        );
        console.log(JSON.stringify(output));
      } else {
        console.log("Your youtube likes playlist is up to date!!!");
      }
    }

    res.redirect(process.env.end);
  })();

  //   createPlaylist().then(() => {
  //     res.redirect(process.env.end);
  //   });
});

app.get("/end", function (req, res) {
  res.send("You reached the end :)");
});

app.listen(PORT);
