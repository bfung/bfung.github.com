(defproject bfung-github-page "0.1.0-SNAPSHOT"
  :description "ClojureScript based personal github page."
  :url "http://bfung.github.com/"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.6.0"]
                 [org.clojure/clojurescript "0.0-3126"]]

  :jvm-opts ["-Xmx1G"]

  :plugins [[lein-cljsbuild "1.0.5"]]

  :cljsbuild {
    :builds [{:id "dev"
              :source-paths ["src/bfung_page"]
              :compiler {
                :output-to "resources/public/js/bfung_page.js"
                :output-dir "resources/public/js"
                :optimizations :none
                :source-map true } } ]
  })
