const { App } = require('@slack/bolt');
const fs = require('fs');
const _ = require('underscore');



// ===== GENERAL =====

// initialize Fordora Ai with bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

app.error((error) => {
  console.error(error);
});


// globals
const MAX = parseInt(process.env.MAX_TIME, 10) || 2147483647;  // max amount of time the timer can have
const admins = (process.env.ADMINS || '').split(',');  // bypass initiator restriction
const channels = (process.env.SAY_CHANNELS || '').split(',');  // channels to post !say messages to
let voteChannel = '';
let initiator = '';
let record = true;
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


app.message('!help', async ({ message, say }) => {
  let helpFile = 'help.json';
  let type = message.text.match(/!help .+/g);
  if (type) {
    type = type[0].substring(6);
    if (type.toLowerCase() === 'fornut') { helpFile = 'help_fornut.json'; }
  }

  const blocks = JSON.parse(fs.readFileSync(`./blocks/${helpFile}`, 'utf8')) || [];
  await say({ blocks });
});



// ===== FORDORA AI =====

app.message('!say', async ({ message, say, context }) => {
  if (!admins.includes(message.user)) {
    await say(`<@${message.user}> is not an admin, you cannot use the !say command.`);
    return;
  }
  let text = message.text.match(/!say .+/g);
  if (text) {
    text = text[0].substring(5);
    try {
      channels.forEach(async channel => await app.client.chat.postMessage({
        token: context.botToken,
        channel,
        text,
      }));
    }
    catch (error) {
      console.log(error);
    }
  } else {
    await say('Usage: !say [message]');
  }
});


app.message('!addtime', async ({ message, say }) => {
  if (!running) {
    await say('No ongoing vote to add time to.');
    return;
  }
  if (initiator && !(initiator === message.user || admins.includes(message.user))) {
    await say(`<@${message.user}> is not the initiator of this vote, you cannot use the !addtime command.`);
    return;
  }
  let amount = message.text.match(/!addtime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(9),10);
    timeLeft = (timeLeft + amount > MAX) ? MAX : timeLeft + amount;
    await say(`Added ${humanTime(amount)} to the timer, ${humanTime(timeLeft)} left.`)
  } else {
    say('Usage: !addtime [amount in seconds]');
  }
});

app.message('!removetime', async ({ message, say }) => {
  if (!running) {
    await say('No ongoing vote to remove time from.');
    return;
  }
  if (initiator && !(initiator === message.user || admins.includes(message.user))) {
    await say(`<@${message.user}> is not the initiator of this vote, you cannot use the !removetime command.`);
    return;
  }
  let amount = message.text.match(/!removetime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(12),10);
    timeLeft = (timeLeft - amount < 0) ? 0 : timeLeft - amount;
    await say(`Removed ${humanTime(amount)} from the timer, ${humanTime(timeLeft)} left.`)
  } else {
    await say('Usage: !removetime [amount in seconds]');
  }
});

app.message('!settime', async ({ message, say }) => {
  if (!running) {
    await say('No ongoing vote to set the time of.');
    return;
  }
  if (initiator && !(initiator === message.user || admins.includes(message.user))) {
    await say(`<@${message.user}> is not the initiator of this vote, you cannot use the !settime command.`);
    return;
  }
  let amount = message.text.match(/!settime \d+/g);
  if (amount) {
    amount = parseInt(amount[0].substring(9),10);
    timeLeft = (amount > MAX) ? MAX : amount;
    await say(`Set timer to ${humanTime(amount)}.`)
  } else {
    await say('Usage: !settime [amount in seconds]');
  }
});

app.message('!timeleft', async ({ say }) => running ? await say(`${humanTime(timeLeft)} left.`) : await say('No ongoing vote.'));


const postOptions = async (message, say, context, listName, options) => {
  if (listName === null && options === null) { listName = 'default'; }
  if (options === null) { options = []; }

  try {
    listName = JSON.parse(fs.readFileSync(`./lists/${listName}.json`, 'utf8'));
  } catch (error) {
    if (options.length < 1) {
      await say('Could not find list. (or list does not conform to standard .json format)');
      cancelVote = true;
      return;
    }
  }

  let optionsList = [];
  if (Array.isArray(listName)) {
    optionsList = listName;
  }
  if (options.length > 0) {
    options.forEach(o => optionsList.push({ name: o, emoji: 'alien' }))
  }

  if (optionsList.length > 0) {
    optionsList.forEach(async (option) => {
      try {
        const sent = await app.client.chat.postMessage({
          "token": context.botToken,
          "channel": voteChannel || message.channel,
          "text": option.name,
        });
        sentOptions.push({name: option.name, emoji: option.emoji || '+1', ts: sent.ts});
        app.client.reactions.add({
          token: context.botToken,
          channel: sent.channel,
          timestamp: sent.ts,
          name: option.emoji || '+1',
        });
      } catch (error) {
        console.log(error);
      }
    });
  } else {
    await say('No options given.');
  }
};

app.message('!cancelvote', async ({ message, say }) => {
  if (running && initiator && !(initiator === message.user || admins.includes(message.user))) {
    await say(`<@${message.user}> is not the initiator of this vote, you cannot use the !cancelvote command.`);
    return;
  }
  running ? cancelVote = true : await say('No ongoing vote to cancel.');
});

app.message('!stopvote', async ({ message, say }) => {
  if (running && initiator && !(initiator === message.user || admins.includes(message.user))) {
    await say(`<@${message.user}> is not the initiator of this vote, you cannot use the !stopvote command.`);
    return;
  }
  running ? timeLeft = 0 : await say('No ongoing vote to stop.');
});

app.message('!startvote', async ({ message, say, context }) => {
  if (running) {
    await say('There is already an ongoing vote.');
    return;
  }

  initiator = message.text.match(/un-pr073c73d/g) ? '' : message.user;
  record = !message.text.match(/no-fl0ckch41n/g);
  let amountOfTime = message.text.match(/time=\d+/g);
  if (amountOfTime) {
    amountOfTime = parseInt(amountOfTime[0].substring(5),10);
    timeLeft = (amountOfTime > MAX) ? MAX : amountOfTime;
  } else {
    timeLeft = 1200;  // default to 20 minutes
  }
  let topN = message.text.match(/amount=\d+/g);
  topN = topN ? parseInt(topN[0].substring(7), 10) : 10;  // List top 10 options by default.
  let type = message.text.match(/type=[^\s]+/g);
  if (type) { type = type[0].substring(5); }
  if (!['approval', 'maximize'].includes(type)) { type = 'approval'; }
  sentOptions = [];
  voteChannel = message.channel;
  running = true;

  const startBlocks = message.text.match(/no-ping/g) ?
    [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Time to vote! Here is the list of options:",
        }
      },
    ]
    :
    [
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
            "text": "*Tip*: If you think an option is missing, post it and the _AI_ will make sure it's in the list next week."
          }
        ]
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
    });
  }
  if (type === 'approval') {
    startBlocks.push({
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "*Type*: approval; list results in order of most voted for to least voted for."
        }
      ]
    });
  } else if (type === 'maximize') {
    startBlocks.push({
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "*Type*: maximize; list results in groups of 2, ordered by the maximized amount of unique voters."
        }
      ]
    });
  }
  startBlocks.push({ "type": "divider" });
  await say({ blocks: startBlocks });

  let listName = message.text.match(/name=[^\s]+/g);
  if (listName) { listName = listName[0].substring(5); }

  let options = message.text.match(/options=\[.+]/g);
  if (options) {
    options = options[0].substring(8);
    options = options.replace(/\[|]|[^\S ]/g, '').split(',').filter(d => d);
  }

  sleep(2000).then(() => postOptions(message, say, context, listName, options));

  const countDown = async () => {
    if (cancelVote) {
      running = false;
      timeLeft = 0;
      cancelVote = false;
      await say('Vote cancelled.');
      return;
    }
    if (timeLeft <= 0) {
      await say({
        blocks: [
          {
            "type": "divider"
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": `Times Up! Here are the top ${topN} final results:`,
            }
          },
          {
            "type": "context",
            "elements": [
              {
                "type": "mrkdwn",
                "text": "*Disclaimer*: Fordora Ai is not responsible for the ordering of ties. (Fisher-Yates shuffle algorithm)"
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
          const reacts = _.find(optionReacts.message.reactions, d => d.name === sent.emoji);
          finalScore.push({ name: sent.name, users: _.tail(reacts.users), count: reacts.count - 1 });
        } catch (error) {
          console.log(error);
        }
      }

      if (type === 'maximize') {
        const pairedFinalScore = [];
        for (let i = 0; i < finalScore.length - 1; i++) {
          for (let j = i + 1; j < finalScore.length; j++) {
            const name = finalScore[i].name + ' & ' + finalScore[j].name;
            const users = { [finalScore[i].name]: finalScore[i].users, [finalScore[j].name]: finalScore[j].users };
            const count = _.union(finalScore[i].users, finalScore[j].users).length;
            pairedFinalScore.push({ name, users, count });
          }
        }
        finalScore = pairedFinalScore;
      }

      finalScore = _.sortBy(_.shuffle(finalScore), 'count').reverse();
      finalScore = finalScore.slice(0, topN);
      const blocks = [];
      finalScore.forEach((option, i) => {
        blocks.push({
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `${i + 1}. *${option.name}*: ${option.count}`
          },
        });
        if (record) {
          if (type === 'maximize') {
            _.mapObject(option.users, (users, option) => {
              const voted = users.map(user => `<@${user}>`);
              blocks.push({
                "type": "context",
                "elements": [
                  {
                    "type": "mrkdwn",
                    "text": `${voted.length > 0 ? `${option} voter(s): ` + voted.join(', ') : `No one voted for ${option}.`}`
                  }
                ]
              });
            })
          } else {
            const voted = option.users.map(user => `<@${user}>`);
            blocks.push({
              "type": "context",
              "elements": [
                {
                  "type": "mrkdwn",
                  "text": `${voted.length > 0 ? 'Voter(s): ' + voted.join(', ') : 'No one voted for this option.'}`
                }
              ]
            });
          }
        }
      });
      blocks.push({ "type": "divider" });
      await say({ blocks });
      sentOptions = [];
      voteChannel = '';
      running = false;
      return;
    }

    timeLeft -= 1;
    setTimeout(countDown, 1000)
  };

  sleep(7000).then(async () => {
    await say(`Voting will end in ${humanTime(timeLeft)}.`);
    countDown();
  });
});


app.message('!addoptions', async ({ message, say, context }) => {
  if (!running) {
    await say('No ongoing vote to add options to.');
    return;
  }
  if (initiator && !(initiator === message.user || admins.includes(message.user))) {
    await say(`<@${message.user}> is not the initiator of this vote, you cannot use the !addoptions command.`);
    return;
  }
  let options = message.text.match(/!addoptions \[.+]/g);
  if (options) {
    options = options[0].substring(12);
    options = options.replace(/\[|]|[^\S ]/g, '').split(',').filter(d => d);
    postOptions(message, say, context, null, options);
  } else {
    await say('Usage: !addoptions [options to add, passed as a list (comma separated)]');
  }
});

app.message('!removeoptions', async ({ message, say, context }) => {
  if (!running) {
    await say('No ongoing vote to remove options from.');
    return;
  }
  if (initiator && !(initiator === message.user || admins.includes(message.user))) {
    await say(`<@${message.user}> is not the initiator of this vote, you cannot use the !removeoptions command.`);
    return;
  }
  let options = message.text.match(/!removeoptions \[.+]/g);
  if (options) {
    options = options[0].substring(15);
    options = options.replace(/\[|]|[^\S ]/g, '').split(',').filter(d => d);
    const [toRemove, newSentOptions] = _.partition(sentOptions, option => options.includes(option.name));
    sentOptions = newSentOptions;
    toRemove.forEach(async (option) => {
      try {
        const deleted = await app.client.chat.delete({
          "token": context.botToken,
          "channel": message.channel,
          "ts": option.ts,
        });
        if (deleted.ok) {
          app.client.chat.postMessage({
            "token": context.botToken,
            "channel": message.channel,
            "text": `Removed ${option.name} from voting list.`,
          });
        }
      } catch (error) {
        console.log(error);
      }
    });
  } else {
    await say('Usage: !removeoptions [options to remove, passed as a list (comma separated)]');
  }
});


// ===== FORNUT =====
const getNonBotUsers = async (message, context) => {
  const getMembers = await app.client.conversations.members({
    "token": context.botToken,
    "channel": message.channel,
  });
  const users = await Promise.all(_.map(getMembers.members, async (u) => {
    const userInfo = await app.client.users.info({
      "token": context.botToken,
      "user": u,
    });
    if (!userInfo.user.is_bot) { return u; }
  }));
  return users.filter(d => d);
};


app.message('!fornut', async ({ message, say, context }) => {
  let size = message.text.match(/size=\d+/g);
  size = size ? parseInt(size[0].substring(5), 10) : 2;  // Groups of 2 by default.
  if (size < 2) { size = 2; }

  const users = await getNonBotUsers(message, context);
  const groups = _.chunk(_.shuffle(users), size);

  const blocks = [
    {
      "type": "image",
      "image_url": "https://i.imgur.com/xcWrTot.png",
      "alt_text": "fornut"
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "Here are the groups:"
      }
    }
  ];
  groups.forEach((group, i) => {
    const members = group.map(member => `<@${member}>`);
    blocks.push({
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": `${i + 1}. ${members.join(', ')}`
        }
      ]
    });
  });
  if (_.last(groups).length < size) {
    blocks.push({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `:ohno:, it looks like the number of users is not divisible by ${size}! <@${message.user}> can decide what to do with group ${groups.length}.`
      }
    });
  }
  await say({ blocks });
});


app.message('!pick', async ({ message, say, context }) => {
  let picked;
  let pickFromList = message.text.match(/!pick \[.+]/g);
  if (pickFromList) {
    await say('Picking from list...');
    pickFromList = pickFromList[0].substring(6);
    pickFromList = pickFromList.replace(/\[|]|[^\S ]/g, '').split(',').filter(d => d);
    picked = _.sample(pickFromList);
  } else {
    await say('Picking from users in this channel...');
    picked = `<@${_.sample(await getNonBotUsers(message, context))}>`;
  }
  await say(picked ? `${picked} has been picked!` : `Could not pick anyone.`);
});



// start Fordora Ai
(async () => {
  await app.start(process.env.PORT || 7890);
  console.log(`Fordora Ai is running on port: ${process.env.PORT || 7890}`);
})();
