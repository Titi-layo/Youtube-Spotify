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

var LikedDetails = [];
var uris = [];
var test;
console.log("The value of test is : ", test);

app.use(express.static(path.join(__dirname, "public")));

//Reusable function to get access_token, used for both youtube api and spotify api

async function _getToken(url, code, redirect, clientID, clientSecret) {
  const result = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirect}&client_id=${clientID}&client_secret=${clientSecret}`,
  });

  const response = await result.json();
  return {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
  };
}

//Reusable function to get access_token from refresh_token, used for spotify api

async function getnewToken(refresh_token) {
  const newAccess = await fetch(spotify_token_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=refresh_token&client_id=${process.env.clientId}&client_secret=${process.env.clientSecret}&refresh_token=${refresh_token}`,
  });

  const result = await newAccess.json();

  return { access_token: result.access_token };
}

//Reusable function to add items to an existing playlist

async function addToPlaylist(playlistID, refresh_token, uris) {
  const result = await getnewToken(refresh_token);

  const output = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistID}/tracks`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${result.access_token}` },
      body: JSON.stringify({ uris: uris }),
    }
  );

  const added = await output.json();

  return added;
}

app.get("/", function (req, res) {
  console.log("hi, i reached the root!!!");

  res.sendFile("/index.html");
  // res.redirect(
  // 	`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YoutubeclientId}&redirect_uri=${process.env.YoutuberedirectUrl}&response_type=${response_type}&scope=${youtube_scope}`
  // );
});

app.get("/login", function (req, res) {
  console.log("hi, i reached the root!!!");

  res.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.YoutubeclientId}&redirect_uri=${process.env.YoutuberedirectUrl}&response_type=${response_type}&scope=${youtube_scope}`
  );
});

app.get("/authentication_tube/", function (req, res) {
  var urls = [];

  (async function getLikedvideos() {
    //http://localhost:8000/authentication_tube/

    const token = await _getToken(
      youtube_token_url,
      req.query.code,
      process.env.YoutuberedirectUrl,
      process.env.YoutubeclientId,
      process.env.YoutubeclientSecret
    );

    const resp = await fetch(
      "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=50",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token.access_token}` },
      }
    );

    const LikedVideos = await resp.json();

    LikedDetails = [];

    //if(process.env.NODE_ENV)
    // {

    LikedVideos.items.map((video) => {
      if (video.snippet.categoryId === "10") {
        let details = getInfo(video.snippet.title);

        if (details) {
          LikedDetails.push({ song: details[1], artist: details[0] });
        }
      }
    });

    console.log(LikedDetails);
    res.redirect(process.env.getSpotifyUris);

    // }

    // else
    // {

    //   LikedVideos.items.map(video => {

    //   if(video.snippet.categoryId === '10')
    //   {
    //     urls.push(`https://www.youtube.com/watch?v=${video.id}`)
    //   }

    // });

    //   youtubedl.getInfo(urls,function(err,info)
    //   {

    //   info.map(info => {

    //       LikedDetails.push({song:info.track, artist:info.artist});

    //   }
    //   )
    //   res.redirect(process.env.getSpotifyUris)
    // })
    // }
  })();
});

app.get("/getSpotifyUris/", function (req, res) {
  uris = [];

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

    const uriPromise = LikedDetails.map(async (details) => {
      const search = await fetch(
        `https://api.spotify.com/v1/search?q=track:${details.song}%20artist:${details.artist}&type=track`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (search.status === 200) {
        const vals = await search.json();

        if (vals.tracks.items.length !== 0) {
          uris.push(vals.tracks.items[0].uri);
        }
      }

      return 1;
    });
    const done = await Promise.all(uriPromise);

    console.log(uris);

    res.redirect(
      `https://accounts.spotify.com/authorize?client_id=${process.env.clientId}&response_type=${response_type}&redirect_uri=${process.env.spotifyAuth}&scope=user-read-private%20playlist-modify-private%20user-read-email%20playlist-modify-public&state=34fFs29kd09`
    );
  })();
});

app.get("/authentication", function (req, res) {
  test = 5;

  const getUserInfo = async () => {
    const token = await _getToken(
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

    console.log(userID.id);

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

    var playlistExists = false;
    var Playlistid;
    playlists.items.map((playlist) => {
      if (playlist.name === playlist_name) {
        playlistExists = true;
        Playlistid = playlist.id;

        return;
      }
    });

    return {
      Exists: playlistExists,
      refresh_token: input.refresh_token,
      id: input.id,
      PlaylistID: Playlistid,
    };
  };

  const createPlaylist = async () => {
    const input = await checkPlaylist();

    if (input.Exists === false) {
      const result = await getnewToken(input.refresh_token);

      const playlist = await fetch(
        `https://api.spotify.com/v1/users/${input.id}/playlists`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${result.access_token}` },
          body: JSON.stringify({ name: "Youtube Likes" }),
        }
      );

      const Newplaylist = await playlist.json();

      const result2 = await getnewToken(input.refresh_token);

      fetch(`https://api.spotify.com/v1/playlists/${Newplaylist.id}/tracks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${result2.access_token}`,
          // 'Content-Type' : 'application/json'
        },
        body: JSON.stringify({ uris: uris }),
      })
        .then((res) => res.json())
        .then((val) => console.log(val));
    } else {
      const result = await getnewToken(input.refresh_token);

      const playlist = await fetch(
        `https://api.spotify.com/v1/playlists/${input.PlaylistID}/tracks`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${result.access_token}` },
        }
      );

      const resp = await playlist.json();
      const playlistItems = resp.items;
      var playlistURIs = [];
      var tobeAdded = [];

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
          input.PlaylistID,
          input.refresh_token,
          tobeAdded
        );
        console.log(output);
      } else {
        console.log("Your youtube likes playlist is up to date!!!");
      }
    }
  };

  createPlaylist();
  res.redirect(process.env.end);
});

app.get("/end/", function (req, res) {
  res.send("You reached the end :)");
});

app.listen(PORT);
