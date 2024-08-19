/**function to get access_token, used for both youtube api and spotify api */

const spotify_token_url = `https://accounts.spotify.com/api/token`;

async function getToken(url, code, redirect, clientID, clientSecret) {
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

//function to get access_token from refresh_token, used for spotify api

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

//function to add items to an existing playlist

async function addToPlaylist(playlistID, newAccessToken, uris) {
  //   const result = await getnewToken(refresh_token);

  const output = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistID}/tracks`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${newAccessToken}` },
      body: JSON.stringify({ uris: uris }),
    }
  );

  const added = await output.json();

  return added;
}

module.exports = {
  getToken,
  getnewToken,
  addToPlaylist,
};
