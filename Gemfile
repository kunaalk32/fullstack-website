source "https://rubygems.org"

# The `github-pages` gem pins Jekyll and all plugins to the exact versions
# GitHub Pages builds with, so a successful local `bundle exec jekyll serve`
# matches what production will render. Do not add a separate `gem "jekyll"`.
gem "github-pages", group: :jekyll_plugins

# Ruby 3.0+ no longer ships WEBrick, which `jekyll serve` uses for its local
# preview server. Harmless in the GitHub Pages build (which doesn't run serve).
gem "webrick"

# github-pages pins Jekyll 3.9, which assumes these are in the standard
# library. Ruby 3.4+ removed them from the defaults, so declare them
# explicitly for local builds. (GitHub Pages builds on an older Ruby that
# still bundles them, so these are inert in production.)
gem "csv"
gem "base64"
gem "logger"
gem "bigdecimal"
