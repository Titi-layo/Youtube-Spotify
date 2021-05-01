# Youtube-Spotify
Server side code, which extracts liked music from youtube account of authorised user and creates new playlist called "Youtube likes" in Spotify containing music


# Prerequisites 

* Node js
* NPM
* Authorized spotify applicatiion (For spotify client ID and client secret) - [Spotify app Authorization](https://developer.spotify.com/documentation/general/guides/app-settings/#register-your-app)
* Youtube developer account - (For Youtube client ID and client secret) - [Youtube app Authorization](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps#php)
* Port 8000 on local machine

# Getting Started

* Clone this repository by entering git clone ... in command line
* Run npm init
* Create a .env file in the root folder and fill where necessary as detailed below 

```
YoutubeclientId=
YoutubeclientSecret=
clientId=
clientSecret=
YoutuberedirectUrl=http://localhost:8000/authentication_tube/
getSpotifyUris=http://localhost:8000/getSpotifyUris/
spotifyAuth=http://localhost:8000/authentication/
end=http://localhost:8000/end/

```

# Runnin locally

* Navigate to root folder in command line
* run `node server.js`
* In web broweser open http://localhost:8000/

