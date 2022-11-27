const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 8080;
const slack_webhook_url = "https://hooks.slack.com/services/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"
const site_name = "api-demo-data-site"

var insert_cache = [];

function sendSlackMessage(message, webhook_url) {
    var request = require('request');
    var options = {
        'method': 'POST',
        'url': webhook_url,
        'headers': {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(message)
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        console.log(response.body);
    });
}

app.use(bodyParser.json());
app.post('/ls2slck', (req, res) => {
    console.log(req.body)
    if (req.body.hasOwnProperty('action')) {
        if (req.body.action == 'INSERT') {
            //if there is new asset store his assetKey into cache
            insert_cache.push(req.body.assetKey);
        }
        else if (req.body.action == 'UPDATE' && insert_cache.indexOf(req.body.assetKey) != -1) {
            //if there is an update on a new inserted asset remove assetKey from cache and send slack message
            insert_cache.splice(insert_cache.indexOf(req.body.assetKey), 1);
            var slack_message = {
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text:
                                `New asset has been discovered by Lansweeper: *${req.body.assetBasicInfo.name}* (${req.body.assetBasicInfo.type}). \nFor more details click <https://app.lansweeper.com/${site_name}/asset/${req.body.assetKey}/summary|here>`,
                        },
                    },
                ],
            };
            console.log(JSON.stringify(slack_message));
            sendSlackMessage(slack_message, slack_webhook_url);
        }
    }
    res.send('I got your webhook')

})
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})