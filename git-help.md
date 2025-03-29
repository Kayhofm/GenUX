# Git Revert Commands

## Step-by-Step Guide to Revert

1. Check your commit history:

```bash
git log --oneline
# Example output:
# a1b2c3d Latest commit
# e4f5g6h Previous commit
# i7j8k9l Old commit
```

2. Save any current changes (if needed):

```bash
git stash
```

3. Choose your revert method:

### Option A: Safe Revert (Recommended)

```bash
git revert a1b2c3d    # Replace with your commit hash
git push              # Push the revert to remote
```

### Option B: Hard Reset (Caution!)

```bash
git reset --hard e4f5g6h    # Replace with your commit hash
git push --force           # Force push to remote
```

4. Restore your saved changes (if any):

```bash
git stash pop
```

⚠️ Important:

- Always commit or stash changes before reverting
- Use `git revert` for safer, reversible changes
- Use `git reset --hard` only if you're sure you want to delete history
