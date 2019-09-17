const { App } = require('@slack/bolt');
const fs = require('fs');
const _ = require('underscore');


// Initializes Fordora Ai with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});


// globals
const MAX = 2147483647;  // max amount of time the timer can have
const admins = ['UJF8U9788'];  // bypass initiator restriction
let initiator = '';
let timeLeft = 0;
let sentOptions = [];
let running = false;
let cancelVote = false;


// https://stackoverflow.com/a/34270811
const humanTime = (seconds) => {
  if (seconds > MAX) { return 'a large amount of time' }
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
  returntext = Boolean(returntext.trim()) ? returntext.trim() : 'no time';
  return returntext;
};

// https://stackoverflow.com/a/39914235
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


app.message('!help', ({ message, say }) =>
  say({
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `Here is a list of things *Fordora Ai* responds to <@${message.user}>:`,
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*!startvote*: start a vote.",
        }
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "_*Args passed as [arg_name]=[arg_value], order does not matter.*_"
          }
        ]
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "*name*: name of the list of options. _[Default: default]_"
          }
        ]
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "*time*: amount of time before the end of the vote (in seconds). _[Default: 1200 (20 minutes)]_"
          }
        ]
      },
      {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "*options*: options to vote on, passed as a list (comma separated). If name arg is also passed, options added to that list. _[Default: []]_"
          }
        ]
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*!stopvote*: stop ongoing vote. (equivalent to setting timer to 0)",
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*!cancelvote*: cancel ongoing vote.",
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*!timeleft*: return how much time is left.",
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*!settime [amount in seconds]*: set the timer to the given amount.",
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*!addtime [amount in seconds]*: add the given amount to the timer.",
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*!removetime [amount in seconds]*: remove the given amount from the timer.",
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*!help*: ...",
        }
      },
      {
        "type": "divider"
      },
    ]
  })
);


app.message('!addtime', ({ message, say }) => {
  if (!running) {
    say('No ongoing vote to add time to.');
    return;
  }
  if (initiator && !(initiator === message.user || admins.includes(message.user))) {
    say(`<@${message.user}> is not the initiator of this vote, you cannot use the !addtime command.`);
    return;
  }
  let amount = message.text.match(/!addtime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(9),10);
    timeLeft = (timeLeft + amount > MAX) ? MAX : timeLeft + amount;
    console.log(`>>> added ${amount} to timer`);
    say(`Added ${humanTime(amount)} to the timer, ${humanTime(timeLeft)} left.`)
  } else {
    say('Usage: !addtime [amount in seconds]');
  }
});

app.message('!removetime', ({ message, say }) => {
  if (!running) {
    say('No ongoing vote to remove time from.');
    return;
  }
  if (initiator && !(initiator === message.user || admins.includes(message.user))) {
    say(`<@${message.user}> is not the initiator of this vote, you cannot use the !removetime command.`);
    return;
  }
  let amount = message.text.match(/!removetime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(12),10);
    timeLeft = (timeLeft - amount < 0) ? 0 : timeLeft - amount;
    console.log(`>>> removed ${amount} from timer`);
    say(`Removed ${humanTime(amount)} from the timer, ${humanTime(timeLeft)} left.`)
  } else {
    say('Usage: !removetime [amount in seconds]');
  }
});

app.message('!settime', ({ message, say }) => {
  if (!running) {
    say('No ongoing vote to set the time of.');
    return;
  }
  if (initiator && !(initiator === message.user || admins.includes(message.user))) {
    say(`<@${message.user}> is not the initiator of this vote, you cannot use the !settime command.`);
    return;
  }
  let amount = message.text.match(/!settime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(9),10);
    timeLeft = (amount > MAX) ? MAX : amount;
    console.log('>>> set timer to', amount);
    say(`Set timer to ${humanTime(amount)}.`)
  } else {
    say('Usage: !settime [amount in seconds]');
  }
});

app.message('!timeleft', ({ say }) => running ? say(`${humanTime(timeLeft)} left.`) : say('No ongoing vote.'));


const postOptions = (message, say, context, listName, options) => {
  if (listName === null && options === null) { listName = 'default'; }
  if (options === null) { options = []; }

  let optionsList = [];
  try {
    listName = JSON.parse(fs.readFileSync(`./lists/${listName}.json`, 'utf8'));
  }
  catch (error) {
    if (options.length < 1) {
      say('Could not find list.');
      cancelVote = true;
      return;
    }
  }

  if (Array.isArray(listName)) {
    optionsList = listName;
  }
  if (options.length > 0) {
    options.forEach(o => optionsList.push({ name: o, emoji: 'alien' }))
  }

  console.log('optionsList:', optionsList);
  optionsList.forEach(async (option) => {
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

app.message('!cancelvote', ({ message, say }) => {
  if (running && initiator && !(initiator === message.user || admins.includes(message.user))) {
    say(`<@${message.user}> is not the initiator of this vote, you cannot use the !cancelvote command.`);
    return;
  }
  running ? cancelVote = true : say('No ongoing vote to cancel.');
});

app.message('!stopvote', ({ message, say }) => {
  if (running && initiator && !(initiator === message.user || admins.includes(message.user))) {
    say(`<@${message.user}> is not the initiator of this vote, you cannot use the !stopvote command.`);
    return;
  }
  running ? timeLeft = 0 : say('No ongoing vote to stop.');
});

app.message('!startvote', ({ message, say, context }) => {
  if (running) {
    say('There is already an ongoing vote');
    return;
  }
  // init
  sentOptions = [];
  initiator = message.text.match(/pr073c73d/g) ? message.user : '';
  const amountOfTime = message.text.match(/time=\d+/g);
  if (amountOfTime) { timeLeft = parseInt(amountOfTime[0].substring(5),10); }
  timeLeft = (timeLeft > 0) ? timeLeft : 1200;  // default to 20 minutes
  running = true;

  const startBlocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "Time to vote for food <!everyone>! Here is the list of options:",
      }
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "*Tip*: If you think an option is missing, post it and the 'AI' will make sure it's in the list next week."
        }
      ]
    },
    {
      "type": "divider"
    },
  ];
  if (initiator !== '') {
    startBlocks.splice(1, 0, {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": `*Initiator*: <@${message.user}>, only they can control this vote.`
        }
      ]
    })
  }
  say({ blocks: startBlocks });

  let listName = message.text.match(/name=[^\s]+/g);
  if (listName) { listName = listName[0].substring(5); }

  let options = message.text.match(/options=\[.+]/g);
  if (options) {
    options = options[0].substring(8);
    options = options.replace(/\[|]|[^\S ]/g, '').split(',');
  }

  // bad fix for 'say' delay
  sleep(2000).then(() => postOptions(message, say, context, listName, options));

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
                "text": "*Disclaimer*: Fordora Ai is not responsible for the ordering of ties."
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
      console.log('final score:', finalScore);
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
      console.log('>>> done');
      return;
    }
    if (cancelVote) {
      running = false;
      timeLeft = 0;
      cancelVote = false;
      console.log('>>> vote cancelled');
      say('Vote cancelled');
      return;
    }
    timeLeft -= 1;
    console.log('timeLeft:', timeLeft);
    setTimeout(countDown, 1000)
  }

  // bad fix for 'say' delay
  sleep(5000).then(() => {
    say(`Voting will end in ${humanTime(timeLeft)}.`);
    console.log('>>> start timer');
    countDown();
  });
});

(async () => {
  // Start Fordora Ai
  await app.start(process.env.PORT || 7890);

  console.log(`⚡️ Fordora Ai is running! (${process.env.PORT || 7890})`);
})();
