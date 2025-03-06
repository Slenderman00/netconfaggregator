from setuptools import setup

setup(
    name="NetconfAggregator",
    version="0.1.2",
    packages=["NetconfAggregator"],
    include_package_data=True,
    install_requires=[
        'psycopg',
        'toml',
        'lxml',
    ],
    entry_points="""
        [console_scripts]
        netconfaggregator=NetconfAggregator.main:main
    """,
)
