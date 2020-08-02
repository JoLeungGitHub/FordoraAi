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
type: type of voting system. [Default: approval]
name: name of the list. [Default: default]
time: amount of time before the end of the vote (in seconds). [Default: 1200 (20 minutes)]
options: options to vote on, passed as a list (comma separated). If name arg is also passed, options added to that list. [Default: []]
amount: amount of options listed at the end of the vote. [Default: 10]

!addoptions [options to add, passed as a list (comma separated)]: add the given options to the voting list.

!removeoptions [options to remove, passed as a list (comma separated)]: remove the given options from the voting list.

!stopvote: stop ongoing vote. (equivalent to setting timer to 0)

!cancelvote: cancel ongoing vote.

!timeleft: return how much time is left.

!settime [amount in seconds]: set the timer to the given amount.

!addtime [amount in seconds]: add the given amount to the timer.

!removetime [amount in seconds]: remove the given amount from the timer.

!say [message]: posts [message] to all channels in the list. (admin only)

!help: prints list of things Fordora Ai responds to.
```


### Voting Type Options
```
approval: list results in order of most voted for to least voted for.
maximize: list results in groups of 2, ordered by the maximized amount of unique voters.
```


<details><summary>Additional !startvote Args</summary>

no-ping; Fordora Ai does not ping @everyone at the start of the vote.

un-pr073c73d; makes it so anyone can use commands that control the vote.

no-fl0ckch41n; does not record who voted for what during the final count.

</details>
