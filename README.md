# Fordora Ai
##### End-to-end food automation.

Lists are generally passed as .json files in the `lists` directory, look at `template.json` to see the standard format:

    [
      {
        "name": "[option]",
        "emoji": "[emoji's first text representation (without :)]"
      },
      ...
      {
        "name": "[option]"
      }
    ]

emoji key is optional, if none is given then it will default to `+1` (thumbs up).


## List of things Fordora Ai responds to:
```
!startvote: starts a vote.
Args passed as [arg_name]=[arg_value], order does not matter.
name: name of the list. [Default: default]
time: amount of time before the end of the vote (in seconds). [Default: 1200 (20 minutes)]
options: options to vote on, passed as a list (comma separated). If name arg is also passed, options added to that list. [Default: []]

!stopvote: stop ongoing vote. (equivalent to setting timer to 0)

!cancelvote: cancel ongoing vote.

!timeleft: return how much time is left.

!settime [amount in seconds]: set the timer to the given amount.

!addtime [amount in seconds]: add the given amount to the timer.

!removetime [amount in seconds]: remove the given amount from the timer.

!help: prints list of things Fordora Ai responds to.
```





<details><summary></summary>
secret !startvote args: 

pr073c73d; makes it so only the person who started the vote can use commands, except for !timeleft (and !help).

no-ping; Fordora Ai does not ping @everyone at the start of the vote.
</details>
