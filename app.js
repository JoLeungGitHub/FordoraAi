const { App } = require('@slack/bolt');
const fs = require('fs');
const _ = require('underscore');


// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});


// globals
let timeLeft = 0;
let sentOptions = [];
let running = false;


// https://stackoverflow.com/a/34270811
const humanTime = (seconds) => {
  const levels = [
    [Math.floor(seconds / 31536000), 'years'],
    [Math.floor((seconds % 31536000) / 86400), 'days'],
    [Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
    [(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
  ];
  let returntext = '';
  levels.forEach((level) => {
    if (level[0] === 0) return;
    returntext += ' ' + level[0] + ' ' + (level[0] === 1 ? level[1].substr(0, level[1].length-1): level[1]);
  });
  returntext = Boolean(returntext) ? returntext.trim() : 'no time';
  return returntext;
};


app.message('!addtime', ({ message, say }) => {
  let amount = message.text.match(/!addtime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(9),10);
    timeLeft += amount;
    say(`Added ${amount} to the timer, ${humanTime(timeLeft)} left.`)
  } else {
    say('Usage: !addtime [amount in seconds]');
  }
});

app.message('!removetime', ({ message, say }) => {
  let amount = message.text.match(/!removetime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(12),10);
    timeLeft = (timeLeft - amount <= 0) ? 0 : timeLeft - amount;
    say(`Removed ${amount} from the timer, ${humanTime(timeLeft)} left.`)
  } else {
    say('Usage: !removetime [amount in seconds]');
  }
});

app.message('!settime', ({ message, say }) => {
  let amount = message.text.match(/!settime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(9),10);
    timeLeft = amount;
    say(`Set timer to ${amount}, ${humanTime(timeLeft)} left.`)
  } else {
    say('Usage: !settime [amount in seconds]');
  }
});

app.message('!timeleft', ({ say }) => {
  say(`${humanTime(timeLeft)} left.`);
});


const postOptions = (message, say, context, getList = './lists/foodora50off.json') => {
  // print foodlist
  const foodList = JSON.parse(fs.readFileSync(getList, 'utf8'));
  foodList.forEach(async (option) => {
    try {
      const sent = await app.client.chat.postMessage({
        "token": context.botToken,
        "channel": message.channel,
        "text": option.name,
      });

      sentOptions.push({name: option.name, emoji: option.emoji || '+1', ts: sent.ts});

      app.client.reactions.add({
        token: context.botToken,
        channel: sent.channel,
        timestamp: sent.ts,
        name: option.emoji || '+1',
      });
    }
    catch (error) {
      console.error(error);
    }
  });
};

// Listens to incoming messages that contain "hello"
app.message('!votefood', ({ message, say, context }) => {
  if (running) {
    say('There is already an ongoing vote');
    return;
  }
  // init
  channel = message.channel;
  sentOptions = [];
  const amountOfTime = message.text.match(/time=\d+/g);
  if (amountOfTime) { timeLeft = parseInt(amountOfTime[0].substring(5),10); }
  timeLeft = (timeLeft > 0) ? timeLeft : 20;
  running = true;

  // say(`Hey there <@${message.user}>! Here is the food list:`);
  say(`Time to vote for food <!everyone>! Here is the list of options:`);

  postOptions(message, say, context);

  // timer
  async function countDown() {
    // Voting period finished
    if (timeLeft <= 0) {
      say({
        blocks: [
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Times Up! Here are the final results:",
            }
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "mrkdwn",
                "text": "*Disclaimer:* Fordora Ai is not responsible for the ordering of ties."
              }
            ]
          },
        ]
      });
      let finalScore = [];
      for (const sent of sentOptions) {
        try {
          const optionReacts = await app.client.reactions.get({
            token: context.botToken,
            channel: message.channel,
            timestamp: sent.ts,
          });
          const count = _.find(optionReacts.message.reactions, d => d.name === sent.emoji).count - 1;
          finalScore.push({ name: sent.name, count: count })
        }
        catch (error) {
          console.error(error);
        }
      }
      finalScore = _.sortBy(finalScore, 'count').reverse();
      console.log(finalScore);
      const blocks = finalScore.map((option, i) => ({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `${i + 1}. *${option.name}*: ${option.count}`
        },
      }));
      blocks.push(
        { "type": "divider" }
      );
      say({ blocks });
      running = false;
      return;
    }
    timeLeft -= 1;
    console.log('timeLeft:', timeLeft);
    setTimeout(countDown, 1000)
  }

  say(`Voting will end in ${timeLeft} seconds.`);
  countDown();
});

(async () => {
  // Start your app
  await app.start(process.env.PORT || 3000);

  console.log('⚡️ Bolt app is running!');
})();
