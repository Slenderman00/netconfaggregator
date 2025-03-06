import argparse
from NetconfAggregator.settings import settings_exist, create_settings, edit_settings

import tntapi
from yangcli import yangcli
from lxml import etree


def main():
    if not settings_exist():
        create_settings()

    parser = argparse.ArgumentParser(description="NetconfAggregator")

    parser.add_argument(
        "--settings",
        "-s",
        action="store_true",
        help="Edit the settings",
    )

    args = parser.parse_args()

    if args.settings:
        edit_settings()
        return


if __name__ == "__main__":
    main()
