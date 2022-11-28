import got from "got";
import express from "express";
import bodyParser from "body-parser";
import { gql, GraphQLClient } from "graphql-request";

const graphqlClient = new GraphQLClient(process.env.LANSWEEPER_API_URL, {
  headers: { authorization: `Token ${process.env.LANSWEEPER_API_TOKEN}` },
});
const app = express();
const port = process.env.APP_PORT;

const insert_asset_cache = [];
const siteCache = {};

const authorizedSitesQuery = gql`
  query getAuthorizedSites {
    authorizedSites {
      sites {
        id
        name
        companyName
      }
    }
  }
`;

const siteIdToName = async (siteId) => {
  const siteData = siteCache[siteId];

  if (!siteData) {
    const result = await graphqlClient.request(authorizedSitesQuery);
    const newSiteFound = result.authorizedSites.sites.find(
      (site) => site.id === siteId
    );

    if (!newSiteFound) {
      throw new Error(`No name found for site ${siteId}`);
    }
    siteCache[siteId] = newSiteFound;
    return newSiteFound.name
  }
  return siteData.name;
};

const buildSlackMessage = async (body) => {
  const siteName = await siteIdToName(body.clientKey);
  const assetUrl = `https://app.lansweeper.com/${siteName}/asset/${body.assetKey}/summary`;
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `New asset has been discovered by Lansweeper: *${body.assetBasicInfo.name}* (${body.assetBasicInfo.type}). \nFor more details click <${assetUrl}|here>`,
        },
      },
    ],
  };
};

const sendSlackMessage = async (message) => {
  var options = {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  };
  await got.post(process.env.SLACK_WEBHOOK_URL, options);
};

app.use(bodyParser.json());
app.post("/ls2slck", async (req, res) => {
  try {
    console.log(req.body);
    if (req.body.hasOwnProperty("action")) {
      if (req.body.action === "INSERT") {
        //if there is new asset store his assetKey into cache
        insert_asset_cache.push(req.body.assetKey);
      } else if (
        req.body.action === "UPDATE" &&
        insert_asset_cache.indexOf(req.body.assetKey) !== -1
      ) {
        //if there is an update on a new inserted asset remove assetKey from cache and send slack message
        insert_asset_cache.splice(
          insert_asset_cache.indexOf(req.body.assetKey),
          1
        );
        var slack_message = await buildSlackMessage(req.body);
        console.log(JSON.stringify(slack_message));
        await sendSlackMessage(slack_message);
      }
    }
    res.send("I got your webhook");
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
